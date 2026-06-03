import { StorageAccessFramework } from 'expo-file-system/legacy';
import { parseId3FromUri } from '../id3Parser';
import { enrichMediaLibraryAssets, importSongsFromSources, scanFromSafFolders } from '../mediaLibraryImport';

jest.mock('expo-file-system/legacy', () => ({
  StorageAccessFramework: { readDirectoryAsync: jest.fn(async () => []) },
}));

jest.mock('../id3Parser', () => ({
  parseId3FromUri: jest.fn(async () => ({})),
}));

jest.mock('../coverCache', () => ({
  cacheBase64Cover: jest.fn(async () => undefined),
  isBase64ImageDataUri: jest.fn(() => false),
}));

beforeEach(() => {
  (parseId3FromUri as jest.Mock).mockReset();
  (parseId3FromUri as jest.Mock).mockResolvedValue({});
  (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockReset();
});

test('media library enrichment reads ID3 by default', async () => {
  (parseId3FromUri as jest.Mock).mockResolvedValue({ title: 'ID3 Title', artist: 'ID3 Artist' });

  const result = await enrichMediaLibraryAssets([
    { id: 's1', uri: 'file:///song.mp3', filename: 'Fallback.mp3', duration: 1 } as any,
  ]);

  expect(parseId3FromUri).toHaveBeenCalledWith('file:///song.mp3');
  expect(result.songs[0].title).toBe('ID3 Title');
  expect(result.songs[0].artist).toBe('ID3 Artist');
});

test('media library enrichment can explicitly skip ID3', async () => {
  const result = await enrichMediaLibraryAssets(
    [{ id: 's1', uri: 'file:///song.mp3', filename: 'Fallback.mp3', duration: 1 } as any],
    0,
    { readId3Tags: false },
  );

  expect(parseId3FromUri).not.toHaveBeenCalled();
  expect(result.songs[0].title).toBe('Fallback');
});

test('SAF scan reads ID3 by default and can explicitly skip it', async () => {
  (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue(['content://root/song.mp3']);
  (parseId3FromUri as jest.Mock).mockResolvedValue({ title: 'SAF Title', artist: 'SAF Artist' });

  const metadataResult = await scanFromSafFolders([
    { id: 'f1', name: 'Root', uri: 'content://root', addedAt: 1, enabled: true },
  ]);
  expect(parseId3FromUri).toHaveBeenCalledWith('content://root/song.mp3');
  expect(metadataResult.songs[0].title).toBe('SAF Title');
  expect(metadataResult.songs[0].artist).toBe('SAF Artist');

  (parseId3FromUri as jest.Mock).mockClear();
  const fastResult = await scanFromSafFolders(
    [{ id: 'f1', name: 'Root', uri: 'content://root', addedAt: 1, enabled: true }],
    { readId3Tags: false },
  );
  expect(parseId3FromUri).not.toHaveBeenCalled();
  expect(fastResult.songs[0].title).toBe('song');
});


test('SAF import from default sources skips ID3 for faster initial import', async () => {
  (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue(['content://root/Fast%20Song.mp3']);
  (parseId3FromUri as jest.Mock).mockResolvedValue({ title: 'Slow ID3 Title' });

  const result = await importSongsFromSources({
    scanFolders: [{ id: 'f1', name: 'Root', uri: 'content://root', addedAt: 1, enabled: true }],
    platformOs: 'android',
  });

  expect(parseId3FromUri).not.toHaveBeenCalled();
  expect(result.songs[0].title).toBe('Fast Song');
  expect(result.songs[0].coverInfo?.status).toBe('none');
});
