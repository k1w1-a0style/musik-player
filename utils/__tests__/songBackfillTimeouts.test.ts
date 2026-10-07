import SystemAudio from 'expo-system-audio';
import type { Song } from '../../types/Song';
import { backfillExistingSongAudioInfo } from '../songAudioInfoBackfill';
import { backfillEmbeddedSongCovers } from '../songCoverBackfill';
import { runNativeReadWithTimeout } from '../nativeReadTimeout';
import { cacheLocalCoverFile } from '../coverCache';

jest.mock('expo-system-audio', () => ({
  extractAudioInfo: jest.fn(),
  extractEmbeddedArtwork: jest.fn(),
  releaseEmbeddedArtworkLease: jest.fn().mockResolvedValue(true),
}));

jest.mock('../coverCache', () => ({
  cacheLocalCoverFile: jest.fn(async (_songId: string, uri?: string) => uri),
  isLikelyVolatileArtworkUri: jest.fn(() => false),
}));

const song = (id: string): Song => ({
  id,
  title: id,
  artist: 'Artist',
  uri: `file:///${id}.mp3`,
  fileInfo: { uri: `file:///${id}.mp3` },
});

afterEach(() => {
  jest.useRealTimers();
  (SystemAudio.extractAudioInfo as jest.Mock).mockReset();
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockReset();
  (SystemAudio.releaseEmbeddedArtworkLease as jest.Mock).mockClear();
});

test('classifies a never-settling native read as a timeout', async () => {
  jest.useFakeTimers();
  const pending = runNativeReadWithTimeout(
    () => new Promise(() => undefined),
    { timeoutMs: 10, label: 'test native read' },
  );

  await jest.advanceTimersByTimeAsync(10);

  await expect(pending).resolves.toEqual({ kind: 'timeout' });
});

test('audio-info timeout retires one worker while another finishes remaining songs', async () => {
  jest.useFakeTimers();
  (SystemAudio.extractAudioInfo as jest.Mock).mockImplementation((uri: string) => {
    if (uri.includes('/a.mp3')) return new Promise(() => undefined);
    return Promise.resolve({
      durationMs: 120000,
      bitrateBps: 192000,
      sizeBytes: 2048,
      sampleRateHz: 44100,
      channels: 2,
    });
  });

  const pending = backfillExistingSongAudioInfo(
    [song('a'), song('b'), song('c')],
    { concurrency: 2, nativeReadTimeoutMs: 10 },
  );

  await jest.advanceTimersByTimeAsync(10);
  const result = await pending;

  expect(result).toMatchObject({ attempted: 3, updated: 2, aborted: false });
  expect(result.songs[0].audioInfo).toBeUndefined();
  expect(result.songs[1].audioInfo).toMatchObject({ bitrate: 192, sampleRate: 44100, channels: 2 });
  expect(result.songs[2].audioInfo).toMatchObject({ bitrate: 192, sampleRate: 44100, channels: 2 });
});

test('cover timeout retires one worker without marking the unresolved song as coverless', async () => {
  jest.useFakeTimers();
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockImplementation((uri: string) => {
    if (uri.includes('/a.mp3')) return new Promise(() => undefined);
    return Promise.resolve({ uri: `${uri}.jpg` });
  });

  const pending = backfillEmbeddedSongCovers(
    [song('a'), song('b'), song('c')],
    { concurrency: 2, nativeReadTimeoutMs: 10 },
  );

  await jest.advanceTimersByTimeAsync(10);
  const result = await pending;

  expect(result).toMatchObject({ attempted: 3, updated: 2 });
  expect(result.songs[0].coverInfo).toBeUndefined();
  expect(result.songs[1].cover).toBe('file:///b.mp3.jpg');
  expect(result.songs[2].cover).toBe('file:///c.mp3.jpg');
});

test('a late receipt after the shorter backfill timeout is released without copying', async () => {
  jest.useFakeTimers();
  (cacheLocalCoverFile as jest.Mock).mockClear();
  let complete!: (value: { uri: string; leaseId: string }) => void;
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const pending = backfillEmbeddedSongCovers([song('a')], { nativeReadTimeoutMs: 10 });
  await jest.advanceTimersByTimeAsync(10);
  await expect(pending).resolves.toMatchObject({ updated: 0, attempted: 1 });
  complete({ uri: 'file:///cache/late.jpg', leaseId: 'late-backfill' });
  await jest.advanceTimersByTimeAsync(0);
  expect(cacheLocalCoverFile).not.toHaveBeenCalled();
  expect(SystemAudio.releaseEmbeddedArtworkLease).toHaveBeenCalledTimes(1);
  expect(SystemAudio.releaseEmbeddedArtworkLease).toHaveBeenCalledWith('late-backfill');
});

test('a receipt arriving after cancelled backfill is released without applying a song patch', async () => {
  jest.useFakeTimers();
  const controller = new AbortController();
  let complete!: (value: { uri: string; leaseId: string }) => void;
  (cacheLocalCoverFile as jest.Mock).mockClear();
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const pending = backfillEmbeddedSongCovers([song('a')], { signal: controller.signal });
  const aborted = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await aborted;
  complete({ uri: 'file:///cache/late.jpg', leaseId: 'aborted-backfill' });
  await jest.advanceTimersByTimeAsync(0);
  expect(cacheLocalCoverFile).not.toHaveBeenCalled();
  expect(SystemAudio.releaseEmbeddedArtworkLease).toHaveBeenCalledTimes(1);
  expect(SystemAudio.releaseEmbeddedArtworkLease).toHaveBeenCalledWith('aborted-backfill');
});
