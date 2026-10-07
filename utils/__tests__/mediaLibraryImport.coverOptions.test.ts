import SystemAudio from 'expo-system-audio';
import { buildSongFromImportSource, enrichMediaLibraryAssets } from '../mediaLibraryImport';
import { cacheLocalCoverFile } from '../coverCache';

jest.mock('../coverCache', () => ({
  cacheBase64Cover: jest.fn(async () => undefined),
  cacheLocalCoverFile: jest.fn(async () => 'file:///documents/covers/permanent.jpg'),
  isBase64ImageDataUri: jest.fn(() => false),
}));

jest.mock('../id3Parser', () => ({
  parseId3FromUri: jest.fn(async () => ({})),
}));

beforeEach(() => {
  (cacheLocalCoverFile as jest.Mock).mockReset();
  (cacheLocalCoverFile as jest.Mock).mockResolvedValue('file:///documents/covers/permanent.jpg');
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockReset();
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue(null);
  (SystemAudio.releaseEmbeddedArtworkLease as jest.Mock).mockReset();
  (SystemAudio.releaseEmbeddedArtworkLease as jest.Mock).mockResolvedValue(true);
});

test('buildSongFromImportSource can skip native cover loading', async () => {
  const song = await buildSongFromImportSource(
    {
      id: 's1',
      uri: 'song.mp3',
      filename: 'Song.mp3',
      source: 'media-library',
    },
    {},
    { loadNativeCover: false },
  );

  expect(SystemAudio.extractEmbeddedArtwork).not.toHaveBeenCalled();
  expect(song.cover).toBeUndefined();
  expect(song.coverInfo).toEqual({ status: 'none', uri: undefined, embeddedArtworkChecked: false });
});

test('enrichMediaLibraryAssets loads native covers by default', async () => {
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue({ uri: 'file:///cover.jpg' });

  const result = await enrichMediaLibraryAssets([
    {
      id: 's1',
      uri: 'song.mp3',
      filename: 'Song.mp3',
      duration: 1,
    } as any,
  ]);

  expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledWith('song.mp3');
  expect(result.songs).toHaveLength(1);
  expect(result.songs[0].cover).toBe('file:///documents/covers/permanent.jpg');
  expect(result.songs[0].coverInfo?.status).toBe('cached');
});

test('copies native staging artwork immediately with the active import protection', async () => {
  const protection = { protectUri: jest.fn(), protectSongCovers: jest.fn(), replaceProtectedSongCovers: jest.fn(), release: jest.fn() };
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue({ uri: 'file:///cache/staging.jpg' });
  const result = await enrichMediaLibraryAssets([{ id: 's1', uri: 'song.mp3', filename: 'Song.mp3', duration: 1 } as any], 0,
    { coverCacheProtection: protection });
  expect(cacheLocalCoverFile).toHaveBeenCalledWith('s1', 'file:///cache/staging.jpg', protection);
  expect(result.songs[0].cover).toBe('file:///documents/covers/permanent.jpg');
});

test('does not save an evictable native artwork URI if its permanent copy fails', async () => {
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue({ uri: 'file:///cache/staging.jpg', leaseId: 'failed-copy' });
  (cacheLocalCoverFile as jest.Mock).mockResolvedValue(undefined);
  const result = await enrichMediaLibraryAssets([{ id: 's1', uri: 'song.mp3', filename: 'Song.mp3', duration: 1 } as any]);
  expect(result.songs[0].cover).toBeUndefined();
  expect(result.songs[0].coverInfo?.embeddedArtworkChecked).toBe(false);
  expect(SystemAudio.releaseEmbeddedArtworkLease).toHaveBeenCalledWith('failed-copy');
});

test('keeps its native receipt until a delayed permanent copy completes', async () => {
  jest.useFakeTimers();
  let completeCopy!: (uri: string) => void;
  let markCopyStarted!: () => void;
  const copyStarted = new Promise<void>(resolve => { markCopyStarted = resolve; });
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue({ uri: 'file:///cache/staging.jpg', leaseId: 'slow-copy' });
  (cacheLocalCoverFile as jest.Mock).mockImplementationOnce(() => new Promise(resolve => {
    markCopyStarted();
    completeCopy = resolve;
  }));
  const pending = buildSongFromImportSource({ id: 's1', uri: 'song.mp3', filename: 'Song.mp3', source: 'media-library' });
  try {
    await copyStarted;
    await jest.advanceTimersByTimeAsync(120_000);
    expect(SystemAudio.releaseEmbeddedArtworkLease).not.toHaveBeenCalled();
    completeCopy('file:///documents/covers/permanent.jpg');
    await expect(pending).resolves.toMatchObject({ cover: 'file:///documents/covers/permanent.jpg' });
    expect(SystemAudio.releaseEmbeddedArtworkLease).toHaveBeenCalledTimes(1);
    expect(SystemAudio.releaseEmbeddedArtworkLease).toHaveBeenCalledWith('slow-copy');
  } finally {
    jest.useRealTimers();
  }
});

test('releases an extracted receipt when cancellation prevents its copy', async () => {
  const controller = new AbortController();
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockImplementationOnce(async () => {
    controller.abort();
    return { uri: 'file:///cache/staging.jpg', leaseId: 'cancelled-copy' };
  });
  await expect(buildSongFromImportSource({ id: 's1', uri: 'song.mp3', filename: 'Song.mp3', source: 'media-library' }, {},
    { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(cacheLocalCoverFile).not.toHaveBeenCalled();
  expect(SystemAudio.releaseEmbeddedArtworkLease).toHaveBeenCalledWith('cancelled-copy');
});

test('releases a receipt returned after the per-file import budget has expired', async () => {
  jest.useFakeTimers();
  let complete!: (value: { uri: string; leaseId: string }) => void;
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const pending = enrichMediaLibraryAssets([{ id: 's1', uri: 'song.mp3', filename: 'Song.mp3', duration: 1 } as any], 0,
    { perFileTimeoutMs: 10 });
  try {
    await jest.advanceTimersByTimeAsync(10);
    await expect(pending).resolves.toMatchObject({ songs: [] });
    expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(1);
    complete({ uri: 'file:///cache/staging.jpg', leaseId: 'late-file-result' });
    await jest.advanceTimersByTimeAsync(0);
    expect(cacheLocalCoverFile).not.toHaveBeenCalled();
    expect(SystemAudio.releaseEmbeddedArtworkLease).toHaveBeenCalledTimes(1);
    expect(SystemAudio.releaseEmbeddedArtworkLease).toHaveBeenCalledWith('late-file-result');
  } finally {
    jest.useRealTimers();
  }
});

test('enrichMediaLibraryAssets can explicitly skip native covers', async () => {
  const result = await enrichMediaLibraryAssets(
    [
      {
        id: 's1',
        uri: 'song.mp3',
        filename: 'Song.mp3',
        duration: 1,
      } as any,
    ],
    0,
    { loadNativeCover: false },
  );

  expect(SystemAudio.extractEmbeddedArtwork).not.toHaveBeenCalled();
  expect(result.songs).toHaveLength(1);
  expect(result.songs[0].cover).toBeUndefined();
  expect(result.songs[0].coverInfo).toEqual({ status: 'none', uri: undefined, embeddedArtworkChecked: false });
});
