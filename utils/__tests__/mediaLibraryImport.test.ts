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


  test('saf directory scan includes nested folders with depth limit', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/sub', 'content://root/a.mp3'];
      if (uri === 'content://root/sub') return ['content://root/sub/b.flac'];
      throw new Error('not-dir');
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', read);
    expect(result.files).toEqual(expect.arrayContaining(['content://root/a.mp3', 'content://root/sub/b.flac']));
  });


  test('saf directory scan does not report plain files as folder errors', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/not-audio.jpg'];
      throw new Error('not-directory');
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', read);
    expect(result.files).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  test('saf import uses tags and fallback', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValueOnce(['content://dir/The%20Artist%20-%20Title.mp3']);
    (parseId3FromUri as jest.Mock).mockResolvedValueOnce({ title: 'Tag Title', artist: 'Tag Artist', cover: 'data:image/jpeg;base64,AAA' });
    const result = await mediaImport.scanFromSafFolders([{ id: 'f1', name: 'Music', uri: 'content://dir', addedAt: 1, enabled: true }] as any);
    expect(result.songs[0].title).toBe('Tag Title');
    expect(result.songs[0].coverInfo?.status).toBe('cached');
    expect(cacheBase64Cover).toHaveBeenCalled();
  });


  test('saf import collects folder errors', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockRejectedValueOnce(new Error('no access'));
    const result = await mediaImport.scanFromSafFolders([{ id: 'f1', name: 'Music', uri: 'content://dir', addedAt: 1, enabled: true }] as any);
    expect(result.errors.length).toBe(1);
    expect(result.folderUpdates?.[0].lastError).toBeTruthy();
  });
});
