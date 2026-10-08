import SystemAudio from 'expo-system-audio';
import { buildSongFromImportSource } from '../mediaLibraryImport';
import { backfillEmbeddedSongCovers, needsEmbeddedCoverBackfill } from '../songCoverBackfill';

jest.mock('expo-system-audio', () => ({
  isAvailable: true,
  inspectEmbeddedArtwork: jest.fn(),
  extractEmbeddedArtwork: jest.fn().mockResolvedValue(null),
  releaseEmbeddedArtworkLease: jest.fn().mockResolvedValue(true),
}));
jest.mock('../coverCache', () => ({
  cacheBase64Cover: jest.fn(async () => undefined),
  cacheLocalCoverFile: jest.fn(async () => 'file:///documents/covers/art.jpg'),
  isBase64ImageDataUri: jest.fn(() => false),
  isLikelyVolatileArtworkUri: jest.fn(() => false),
}));

const source = { id: 'song', uri: 'content://documents/song.mp3', filename: 'Song.mp3', source: 'saf' as const };
const song = { id: 'song', uri: source.uri, title: 'Title', artist: 'Artist' };

beforeEach(() => {
  jest.clearAllMocks();
});

test('an import with skipped native inspection remains a backfill candidate', async () => {
  (SystemAudio.inspectEmbeddedArtwork as jest.Mock).mockResolvedValue({ checked: false, artwork: null });
  const imported = await buildSongFromImportSource(source);
  expect(imported.coverInfo?.embeddedArtworkChecked).toBe(false);
  expect(needsEmbeddedCoverBackfill(imported)).toBe(true);
  expect(SystemAudio.extractEmbeddedArtwork).not.toHaveBeenCalled();
});

test('only a completed empty import inspection becomes a stable no-cover result', async () => {
  (SystemAudio.inspectEmbeddedArtwork as jest.Mock).mockResolvedValue({ checked: true, artwork: null });
  const imported = await buildSongFromImportSource(source);
  expect(imported.coverInfo?.embeddedArtworkChecked).toBe(true);
  expect(needsEmbeddedCoverBackfill(imported)).toBe(false);
});

test('a busy backfill does not confirm missing artwork or consume a pending refresh', async () => {
  (SystemAudio.inspectEmbeddedArtwork as jest.Mock).mockResolvedValue({ checked: false, artwork: null });
  const pending = { ...song, cover: 'file:///preview.jpg', coverInfo: {
    status: 'external' as const, uri: 'file:///preview.jpg', pendingEmbeddedArtworkRefresh: true,
  } };
  const result = await backfillEmbeddedSongCovers([pending]);
  expect(result.songs[0]).toBe(pending);
  expect(needsEmbeddedCoverBackfill(result.songs[0])).toBe(true);
  expect(result).toMatchObject({ updated: 0, attempted: 1 });
});

test('a later successful backfill can still acquire and cache the artwork', async () => {
  (SystemAudio.inspectEmbeddedArtwork as jest.Mock).mockResolvedValueOnce({ checked: false, artwork: null })
    .mockResolvedValueOnce({ checked: true, artwork: { uri: 'file:///cache/art.jpg', mimeType: 'image/jpeg', leaseId: 'lease' } });
  const first = await backfillEmbeddedSongCovers([song]);
  const second = await backfillEmbeddedSongCovers(first.songs);
  expect(second.songs[0]).toMatchObject({ cover: 'file:///documents/covers/art.jpg', coverInfo: { embeddedArtworkChecked: true } });
  expect(SystemAudio.releaseEmbeddedArtworkLease).toHaveBeenCalledTimes(1);
  expect(SystemAudio.releaseEmbeddedArtworkLease).toHaveBeenCalledWith('lease');
});
