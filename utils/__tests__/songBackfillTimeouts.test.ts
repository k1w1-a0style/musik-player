import SystemAudio from 'expo-system-audio';
import type { Song } from '../../types/Song';
import { backfillExistingSongAudioInfo } from '../songAudioInfoBackfill';
import { backfillEmbeddedSongCovers } from '../songCoverBackfill';
import { runNativeReadWithTimeout } from '../nativeReadTimeout';

jest.mock('expo-system-audio', () => ({
  extractAudioInfo: jest.fn(),
  extractEmbeddedArtwork: jest.fn(),
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
