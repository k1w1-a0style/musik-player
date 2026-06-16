import SystemAudio from 'expo-system-audio';
import { backfillEmbeddedSongCovers } from '../songCoverBackfill';
import type { Song } from '../../types/Song';

jest.mock('expo-system-audio', () => ({
  extractEmbeddedArtwork: jest.fn(),
}));

const song = (id: string, patch: Partial<Song> = {}): Song => ({
  id,
  title: id,
  artist: 'Artist',
  uri: `file:///${id}.mp3`,
  ...patch,
});

beforeEach(() => {
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockReset();
});

test('backfills songs without covers and skips existing artwork', async () => {
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue({ uri: 'file:///cover-a.jpg' });

  const result = await backfillEmbeddedSongCovers([
    song('a'),
    song('b', { cover: 'file:///existing.jpg', coverInfo: { status: 'cached', uri: 'file:///existing.jpg' } }),
  ]);

  expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(1);
  expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledWith('file:///a.mp3');
  expect(result.songs[0]).toMatchObject({ cover: 'file:///cover-a.jpg', coverInfo: { status: 'embedded', uri: 'file:///cover-a.jpg' } });
  expect(result.songs[1].cover).toBe('file:///existing.jpg');
});

test('per-song extraction failures do not abort the whole backfill', async () => {
  (SystemAudio.extractEmbeddedArtwork as jest.Mock)
    .mockRejectedValueOnce(new Error('bad'))
    .mockResolvedValueOnce({ uri: 'file:///cover-b.jpg' });

  const result = await backfillEmbeddedSongCovers([song('a'), song('b')], { concurrency: 1 });

  expect(result.songs[0].coverInfo?.status).toBe('none');
  expect(result.songs[1].cover).toBe('file:///cover-b.jpg');
});

test('abort prevents stale updates from completing', async () => {
  const controller = new AbortController();
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockImplementation(async () => {
    controller.abort();
    return { uri: 'file:///late.jpg' };
  });

  await expect(backfillEmbeddedSongCovers([song('a')], { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
});

test('limits concurrent native artwork extraction', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockImplementation(async (uri: string) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise(resolve => setTimeout(resolve, 10));
    inFlight -= 1;
    return { uri: `${uri}.jpg` };
  });

  await backfillEmbeddedSongCovers([song('a'), song('b'), song('c')], { concurrency: 99 });

  expect(maxInFlight).toBeLessThanOrEqual(2);
});
