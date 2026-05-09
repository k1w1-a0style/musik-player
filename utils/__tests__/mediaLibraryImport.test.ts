import { StorageAccessFramework } from 'expo-file-system/legacy';
import { cacheBase64Cover } from '../coverCache';
import { parseId3FromUri } from '../id3Parser';
import * as mediaImport from '../mediaLibraryImport';

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(async () => ({ exists: true, size: 123 })),
  StorageAccessFramework: { readDirectoryAsync: jest.fn(async () => []) },
}));
jest.mock('../id3Parser', () => ({ parseId3FromUri: jest.fn(async () => ({})) }));
jest.mock('../coverCache', () => ({ cacheBase64Cover: jest.fn(async (_id: string, c?: string) => c ? 'file:///cover.jpg' : undefined), isBase64ImageDataUri: (v?: string) => !!v?.startsWith('data:image/') }));

describe('mediaLibraryImport', () => {
  test('classifySafReadDirectoryError classifies directory/access/unknown errors', () => {
    expect(mediaImport.classifySafReadDirectoryError(new Error('ENOTDIR'))).toBe('not-directory');
    expect(mediaImport.classifySafReadDirectoryError('this is not a directory')).toBe('not-directory');
    expect(mediaImport.classifySafReadDirectoryError(new Error('SecurityException: Permission denied'))).toBe('permission');
    expect(mediaImport.classifySafReadDirectoryError(new Error("Location 'content://x' isn't readable."))).toBe('permission');
    expect(mediaImport.classifySafReadDirectoryError(new Error("Location 'content://x' is not readable."))).toBe('permission');
    expect(mediaImport.classifySafReadDirectoryError(new Error('not readable'))).toBe('permission');
    expect(mediaImport.classifySafReadDirectoryError(new Error('cannot read'))).toBe('permission');
    expect(mediaImport.classifySafReadDirectoryError(new Error('failed to read children'))).toBe('permission');
    expect(mediaImport.classifySafReadDirectoryError(new Error('EACCES'))).toBe('permission');
    expect(mediaImport.classifySafReadDirectoryError(new Error('EPERM operation not permitted'))).toBe('permission');
    expect(mediaImport.classifySafReadDirectoryError(new Error('random failure'))).toBe('unknown');
  });

  test('loads all pages', async () => {
    const getAssetsPage = jest.fn(async ({ after }: { after?: string }) => (!after
      ? { assets: [{ id: '1' }, { id: '2' }], hasNextPage: true, endCursor: 'a' }
      : { assets: [{ id: '3' }], hasNextPage: false, endCursor: 'b' })) as any;
    const result = await mediaImport.loadAllAudioAssetsFromMediaLibrary(getAssetsPage);
    expect(result.map(a => a.id)).toEqual(['1', '2', '3']);
  });

  test('saf scan enters dotted folders like AC.DC and Vol.1', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/AC.DC', 'content://root/Vol.1'];
      if (uri === 'content://root/AC.DC') return ['content://root/AC.DC/a.mp3'];
      if (uri === 'content://root/Vol.1') return ['content://root/Vol.1/b.flac'];
      throw new Error('not-dir');
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', read);
    expect(result.files).toEqual(expect.arrayContaining(['content://root/AC.DC/a.mp3', 'content://root/Vol.1/b.flac']));
  });

  test('known and unknown non-audio child read failures do not produce SAF errors', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') {
        return [
          'content://root/cover.jpg',
          'content://root/folder.jpg',
          'content://root/playlist.m3u',
          'content://root/README',
          'content://root/.nomedia',
          'content://root/unknownSidecar',
          'content://root/notes.xyz',
        ];
      }
      throw new Error('ENOTDIR not a directory');
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', read);
    expect(result.errors).toEqual([]);
    expect(result.files).toEqual([]);
  });

  test('child read failure is ignored for unknown entries and keeps root audio files', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/song.mp3', 'content://root/unknown.entry'];
      throw new Error('random unknown failure');
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', read);
    expect(result.files).toEqual(['content://root/song.mp3']);
    expect(result.errors).toEqual([]);
  });

  test('child dotted folder permission failure is reported', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/AC.DC'];
      throw new Error('permission denied');
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', read);
    expect(result.errors).toEqual(['content://root/AC.DC']);
  });

  test('child dotted folder security failure is reported', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/Vol.1'];
      throw new Error('SecurityException: SAF access denied');
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', read);
    expect(result.errors).toEqual(['content://root/Vol.1']);
  });

  test('child unreadable location failure is reported', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/unreadable'];
      throw new Error("Location 'content://root/unreadable' isn't readable.");
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', read);
    expect(result.errors).toEqual(['content://root/unreadable']);
  });

  test('child not-readable failure is reported', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/no-read'];
      throw new Error('not readable');
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', read);
    expect(result.errors).toEqual(['content://root/no-read']);
  });

  test('root unknown read failure is always reported', async () => {
    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', async () => {
      throw new Error('generic root failure');
    });
    expect(result.errors).toEqual(['content://root']);
  });

  test('saf recursion respects depth limit and file cap', async () => {
    const deepRead = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/l1'];
      if (uri === 'content://root/l1') return ['content://root/l1/l2'];
      if (uri === 'content://root/l1/l2') return ['content://root/l1/l2/l3'];
      if (uri === 'content://root/l1/l2/l3') return ['content://root/l1/l2/l3/deep.mp3'];
      return [];
    });
    const depthResult = await mediaImport.readAudioUrisFromSafDirectory('content://root', deepRead);
    expect(depthResult.files).toEqual([]);

    const many = Array.from({ length: 6000 }, (_, idx) => `content://root/${idx}.mp3`);
    const capResult = await mediaImport.readAudioUrisFromSafDirectory('content://root', async () => many);
    expect(capResult.files.length).toBe(mediaImport.MAX_SAF_FILES);
  });

  test('saf recursion uses visited set to avoid cycles', async () => {
    const cyclicRead = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/loop'];
      if (uri === 'content://root/loop') return ['content://root'];
      return [];
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', cyclicRead);
    expect(result.errors).toEqual([]);
    expect(cyclicRead).toHaveBeenCalledTimes(2);
  });

  test('scanFromSafFolders sets partial error for child permission failures and keeps songs', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockImplementation(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/song.mp3', 'content://root/unknown.entry'];
      throw new Error('permission denied');
    });
    const result = await mediaImport.scanFromSafFolders([{ id: 'f1', name: 'Root', uri: 'content://root', addedAt: 1, enabled: true }] as any);
    expect(result.songs.length).toBe(1);
    expect(result.errors).toEqual(['content://root/unknown.entry']);
    expect(result.folderUpdates?.[0].lastError).toBe('Teilweise nicht lesbar');
  });

  test('scanFromSafFolders sets partial error for child readability failures and keeps songs', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockImplementation(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/song.mp3', 'content://root/subdir'];
      throw new Error("Location 'content://root/subdir' isn't readable.");
    });
    const result = await mediaImport.scanFromSafFolders([{ id: 'f1', name: 'Root', uri: 'content://root', addedAt: 1, enabled: true }] as any);
    expect(result.songs.length).toBe(1);
    expect(result.errors).toEqual(['content://root/subdir']);
    expect(result.folderUpdates?.[0].lastError).toBe('Teilweise nicht lesbar');
  });

  test('scanFromSafFolders ignores child ENOTDIR errors for lastError', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockImplementation(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/song.mp3', 'content://root/subdir'];
      if (uri === 'content://root/subdir') throw new Error('ENOTDIR');
      return [];
    });
    const result = await mediaImport.scanFromSafFolders([{ id: 'f1', name: 'Root', uri: 'content://root', addedAt: 1, enabled: true }] as any);
    expect(result.songs.length).toBe(1);
    expect(result.errors).toEqual([]);
    expect(result.folderUpdates?.[0].lastError).toBeUndefined();
  });

  test('scanFromSafFolders ignores unknown child errors for lastError', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockImplementation(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/song.mp3', 'content://root/subdir'];
      if (uri === 'content://root/subdir') throw new Error('generic failure');
      return [];
    });
    const result = await mediaImport.scanFromSafFolders([{ id: 'f1', name: 'Root', uri: 'content://root', addedAt: 1, enabled: true }] as any);
    expect(result.songs.length).toBe(1);
    expect(result.errors).toEqual([]);
    expect(result.folderUpdates?.[0].lastError).toBeUndefined();
  });

  test('saf import uses tags and fallback', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValueOnce(['content://dir/The%20Artist%20-%20Title.mp3']);
    (parseId3FromUri as jest.Mock).mockResolvedValueOnce({ title: 'Tag Title', artist: 'Tag Artist', cover: 'data:image/jpeg;base64,AAA' });
    const result = await mediaImport.scanFromSafFolders([{ id: 'f1', name: 'Music', uri: 'content://dir', addedAt: 1, enabled: true }] as any);
    expect(result.songs[0].title).toBe('Tag Title');
    expect(result.songs[0].coverInfo?.status).toBe('cached');
    expect(cacheBase64Cover).toHaveBeenCalled();
  });

  test('saf import collects root folder errors', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockRejectedValueOnce(new Error('no access'));
    const result = await mediaImport.scanFromSafFolders([{ id: 'f1', name: 'Music', uri: 'content://dir', addedAt: 1, enabled: true }] as any);
    expect(result.errors.length).toBe(1);
    expect(result.folderUpdates?.[0].lastError).toBe('Nicht lesbar');
  });
});
