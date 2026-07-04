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

  expect(parseId3FromUri).toHaveBeenCalledWith('file:///song.mp3', expect.objectContaining({ signal: undefined, filename: 'Fallback.mp3', extension: 'mp3' }));
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
  expect(parseId3FromUri).toHaveBeenCalledWith('content://root/song.mp3', expect.objectContaining({ signal: undefined, extension: 'mp3' }));
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


test('media library enrichment passes abort signal to ID3 reads', async () => {
  const controller = new AbortController();

  await enrichMediaLibraryAssets(
    [{ id: 's1', uri: 'file:///song.mp3', filename: 'Fallback.mp3', duration: 1 } as any],
    0,
    { readId3Tags: true, signal: controller.signal },
  );

  expect(parseId3FromUri).toHaveBeenCalledWith('file:///song.mp3', expect.objectContaining({ signal: controller.signal, filename: 'Fallback.mp3', extension: 'mp3' }));
});


test('media library enrichment passes filename and MIME hints for opaque content URI ID3 reads', async () => {
  (parseId3FromUri as jest.Mock).mockResolvedValue({ title: 'Embedded MP4 Title', artist: 'Embedded MP4 Artist' });

  const result = await enrichMediaLibraryAssets([
    { id: 's1', uri: 'content://media/external/audio/media/42', filename: 'Song.m4a', duration: 1, mimeType: 'audio/mp4' } as any,
  ]);

  expect(parseId3FromUri).toHaveBeenCalledWith(
    'content://media/external/audio/media/42',
    expect.objectContaining({ filename: 'Song.m4a', mimeType: 'audio/mp4', extension: 'm4a' }),
  );
  expect(result.songs[0].title).toBe('Embedded MP4 Title');
  expect(result.songs[0].artist).toBe('Embedded MP4 Artist');
});

test('media library enrichment does not swallow ID3 abort as empty tags', async () => {
  const controller = new AbortController();
  const abortError = new Error('cancelled');
  (parseId3FromUri as jest.Mock).mockImplementationOnce(async () => {
    controller.abort(abortError);
    throw abortError;
  });

  await expect(enrichMediaLibraryAssets(
    [{ id: 's1', uri: 'file:///song.mp3', filename: 'Fallback.mp3', duration: 1 } as any],
    0,
    { readId3Tags: true, signal: controller.signal },
  )).rejects.toThrow('cancelled');
});

test('media library enrichment treats non-abort ID3 failures as empty tags', async () => {
  (parseId3FromUri as jest.Mock).mockRejectedValueOnce(new Error('bad tags'));

  const result = await enrichMediaLibraryAssets([
    { id: 's1', uri: 'file:///Fallback.mp3', filename: 'Fallback.mp3', duration: 1 } as any,
  ]);

  expect(result.songs[0].title).toBe('Fallback');
  expect(result.errors).toEqual([]);
});


test('SAF scan passes abort signal to ID3 reads', async () => {
  const controller = new AbortController();
  (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue(['content://root/song.mp3']);

  await scanFromSafFolders(
    [{ id: 'f1', name: 'Root', uri: 'content://root', addedAt: 1, enabled: true }],
    { readId3Tags: true, signal: controller.signal },
  );

  expect(parseId3FromUri).toHaveBeenCalledWith('content://root/song.mp3', expect.objectContaining({ signal: controller.signal, extension: 'mp3' }));
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
  expect(result.songs[0].coverInfo).toEqual({ status: 'none', uri: undefined, embeddedArtworkChecked: false });
});

test('SAF scan recursively keeps Huawei-like uppercase and encoded audio entries while skipping bad children', async () => {
  (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockImplementation(async (uri: string) => {
    if (uri === 'content://root') return ['content://root/Album', 'content://root/cover.JPG'];
    if (uri === 'content://root/Album') return ['content://root/Album/HUAWEI%20TRACK.M4A', 'content://root/Album/Broken'];
    if (uri === 'content://root/Album/Broken') throw new Error('provider failed to read child');
    return [];
  });

  const result = await scanFromSafFolders(
    [{ id: 'f1', name: 'Root', uri: 'content://root', addedAt: 1, enabled: true }],
    { readId3Tags: false },
  );

  expect(result.songs).toHaveLength(1);
  expect(result.songs[0].title).toBe('HUAWEI TRACK');
  expect(result.errors).toEqual(['content://root/Album/Broken']);
});

test('SAF scan returns useful folder diagnostics when provider root is unreadable', async () => {
  (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockRejectedValue(new Error('permission denied'));

  const result = await scanFromSafFolders(
    [{ id: 'f1', name: 'Huawei Music', uri: 'content://root', addedAt: 1, enabled: true }],
    { readId3Tags: false },
  );

  expect(result.songs).toHaveLength(0);
  expect(result.errors).toEqual(['content://root']);
  expect(result.folderUpdates?.[0]).toMatchObject({ lastError: 'Nicht lesbar' });
  expect(result.sourceSummary[0]).toMatchObject({ source: 'saf', imported: 0, errors: 1 });
});
