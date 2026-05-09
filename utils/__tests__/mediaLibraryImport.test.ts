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

  test('known and unknown non-audio files do not produce SAF errors', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') {
        return [
          'content://root/cover.jpg',
          'content://root/folder.jpg',
          'content://root/playlist.m3u',
          'content://root/README',
          'content://root/.nomedia',
          'content://root/unknownSidecar',
          'content://root/album.log',
          'content://root/notes.xyz',
        ];
      }
      throw new Error('not-directory');
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', read);
    expect(result.errors).toEqual([]);
    expect(result.files).toEqual([]);
  });

  test('child read failure is ignored for unknown non-directory entries and keeps audio files', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/song.mp3', 'content://root/unknown.entry'];
      throw new Error('no access');
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', read);
    expect(result.files).toEqual(['content://root/song.mp3']);
    expect(result.errors).toEqual([]);
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

  test('scanFromSafFolders keeps readable songs when unknown child entries fail to open', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockImplementation(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/song.mp3', 'content://root/blocked'];
      throw new Error('no access');
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
