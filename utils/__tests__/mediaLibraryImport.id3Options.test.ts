import { StorageAccessFramework } from 'expo-file-system/legacy';
import { parseId3FromUri } from '../id3Parser';
import { enrichMediaLibraryAssets, scanFromSafFolders } from '../mediaLibraryImport';

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

test('media library enrichment skips ID3 by default', async () => {
  const result = await enrichMediaLibraryAssets([
    { id: 's1', uri: 'file:///song.mp3', filename: 'Fallback.mp3', duration: 1 } as any,
  ]);

  expect(parseId3FromUri).not.toHaveBeenCalled();
  expect(result.songs[0].title).toBe('Fallback');
});

test('media library enrichment reads ID3 when enabled', async () => {
  (parseId3FromUri as jest.Mock).mockResolvedValue({ title: 'ID3 Title', artist: 'ID3 Artist' });

  const result = await enrichMediaLibraryAssets(
    [{ id: 's1', uri: 'file:///song.mp3', filename: 'Fallback.mp3', duration: 1 } as any],
    0,
    { readId3Tags: true },
  );

  expect(parseId3FromUri).toHaveBeenCalledWith('file:///song.mp3');
  expect(result.songs[0].title).toBe('ID3 Title');
  expect(result.songs[0].artist).toBe('ID3 Artist');
});

test('SAF scan reads ID3 only when enabled', async () => {
  (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue(['content://root/song.mp3']);
  (parseId3FromUri as jest.Mock).mockResolvedValue({ title: 'SAF Title', artist: 'SAF Artist' });

  const fastResult = await scanFromSafFolders([
    { id: 'f1', name: 'Root', uri: 'content://root', addedAt: 1, enabled: true },
  ]);
  expect(parseId3FromUri).not.toHaveBeenCalled();
  expect(fastResult.songs[0].title).toBe('song');

  const metadataResult = await scanFromSafFolders(
    [{ id: 'f1', name: 'Root', uri: 'content://root', addedAt: 1, enabled: true }],
    { readId3Tags: true },
  );
  expect(parseId3FromUri).toHaveBeenCalledWith('content://root/song.mp3');
  expect(metadataResult.songs[0].title).toBe('SAF Title');
  expect(metadataResult.songs[0].artist).toBe('SAF Artist');
});
