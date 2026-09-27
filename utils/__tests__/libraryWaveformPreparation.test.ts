import AsyncStorage from '@react-native-async-storage/async-storage';
import SystemAudio from 'expo-system-audio';
import type { Song } from '../../types/Song';
import { getCachedWaveform, resetWaveformCacheStateForTests, setCachedWaveform } from '../waveformCache';
import { buildNativeWaveform, getWaveformSourceIdentity } from '../waveformGenerator';
import { resetWaveformExtractionLifecycleForTests } from '../waveformExtractionLifecycle';
import { cancelWaveformPreparation, getWaveformPreparationState, prepareLibraryWaveforms,
  resetWaveformPreparationForTests, resumeWaveformPreparation } from '../libraryWaveformPreparation';
import { getWaveformStatus } from '../waveformStatus';

const audio = SystemAudio as typeof SystemAudio & { extractWaveformPeaks: jest.Mock };
const song = (id: string): Song => ({ id, title: id, artist: 'Artist', uri: `file:///${id}.mp3`, duration: 90_000 });
const decoded = { points: [0.04, 0.8, 0.1, 1, 0.4, 0.9, 0.2, 0.5], durationMs: 90_000,
  analysis: 'decoded-pcm-v1' as const };

beforeEach(async () => {
  resetWaveformPreparationForTests(); resetWaveformExtractionLifecycleForTests(); resetWaveformCacheStateForTests();
  await AsyncStorage.clear();
  jest.useFakeTimers();
  audio.extractWaveformPeaks = jest.fn().mockResolvedValue(decoded);
});
afterEach(() => {
  resetWaveformPreparationForTests(); resetWaveformExtractionLifecycleForTests(); resetWaveformCacheStateForTests();
  jest.useRealTimers();
});

test('prepares uncached songs once, keeps cached songs, and continues after an unreadable song', async () => {
  const cached = song('cached'); const missing = song('missing'); const fresh = song('fresh');
  await setCachedWaveform(buildNativeWaveform(cached, decoded, 90_000, 1024));
  audio.extractWaveformPeaks.mockResolvedValueOnce(null).mockResolvedValueOnce(decoded);
  const task = prepareLibraryWaveforms([cached, missing, fresh]);
  await jest.advanceTimersByTimeAsync(1000);
  await task;
  expect(getWaveformPreparationState()).toMatchObject({ status: 'completed', total: 3, processed: 3, ready: 2, failed: 1 });
  expect(audio.extractWaveformPeaks.mock.calls.map(call => call[0])).toEqual(['file:///missing.mp3', 'file:///fresh.mp3']);
  expect(getWaveformStatus(getWaveformSourceIdentity(missing).sourceFingerprint)).toBe('unavailable');
  // Survives a fresh JS cache: success is backed by the stored waveform.
  resetWaveformCacheStateForTests();
  await expect(getCachedWaveform(getWaveformSourceIdentity(fresh))).resolves.toMatchObject({ source: 'native' });
});

test('cancel preserves completed cache entries and resume skips their decoder work', async () => {
  const first = song('first'); const second = song('second');
  let finishSecond!: (value: typeof decoded) => void;
  audio.extractWaveformPeaks.mockResolvedValueOnce(decoded)
    .mockImplementationOnce(() => new Promise(resolve => { finishSecond = resolve; }));
  const task = prepareLibraryWaveforms([first, second]);
  await jest.advanceTimersByTimeAsync(240);
  expect(getWaveformPreparationState()).toMatchObject({ processed: 1, ready: 1 });
  cancelWaveformPreparation();
  await task;
  expect(getWaveformPreparationState().status).toBe('cancelled');
  finishSecond(decoded);
  await jest.advanceTimersByTimeAsync(0);
  audio.extractWaveformPeaks.mockResolvedValue(decoded);
  const resumed = resumeWaveformPreparation();
  await jest.advanceTimersByTimeAsync(1000);
  await resumed;
  expect(getWaveformPreparationState()).toMatchObject({ status: 'completed', processed: 2, ready: 2 });
  expect(audio.extractWaveformPeaks.mock.calls.filter(call => call[0] === first.uri)).toHaveLength(1);
});

test('an external cancel during a queued analysis stops the same preparation', async () => {
  const controller = new AbortController();
  const task = prepareLibraryWaveforms([song('not-started')], { signal: controller.signal });
  controller.abort();
  await task;
  await jest.advanceTimersByTimeAsync(500);
  expect(audio.extractWaveformPeaks).not.toHaveBeenCalled();
  expect(getWaveformPreparationState()).toMatchObject({ status: 'cancelled', processed: 0 });
});
