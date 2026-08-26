import AsyncStorage from '@react-native-async-storage/async-storage';
import SystemAudio from 'expo-system-audio';
import type { Song } from '../../types/Song';
import { getCachedWaveform, resetWaveformCacheStateForTests } from '../waveformCache';
import { extractNativeWaveform } from '../waveformExtraction';
import {
  resetWaveformExtractionLifecycleForTests,
  WAVEFORM_EXTRACTION_DEBOUNCE_MS,
} from '../waveformExtractionLifecycle';
import { getWaveformSourceIdentity } from '../waveformGenerator';
import {
  MAX_BACKGROUND_WAVEFORM_PRELOAD_DURATION_MS,
  preloadSongWaveform,
  resetWaveformPreloadStateForTests,
} from '../waveformPreload';

const extractor = SystemAudio as typeof SystemAudio & { extractWaveformPeaks: jest.Mock };
const song: Song = {
  id: 'preload-song',
  title: 'Preload song',
  artist: 'Artist',
  uri: 'file:///preload-song.mp3',
  duration: 90_000,
};
const decoded = {
  points: [0.04, 0.88, 0.12, 0.76, 0.2, 0.92, 0.34, 0.68, 0.16, 0.84],
  durationMs: 90_000,
  analysis: 'decoded-pcm-v1' as const,
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
};

describe('waveformPreload', () => {
  beforeEach(async () => {
    resetWaveformExtractionLifecycleForTests();
    resetWaveformCacheStateForTests();
    resetWaveformPreloadStateForTests();
    await AsyncStorage.clear();
    extractor.extractWaveformPeaks = jest.fn().mockResolvedValue(decoded);
    jest.useFakeTimers();
  });

  afterEach(() => {
    resetWaveformExtractionLifecycleForTests();
    resetWaveformCacheStateForTests();
    resetWaveformPreloadStateForTests();
    jest.useRealTimers();
  });

  test('warms one canonical native waveform and reuses it on later requests', async () => {
    const first = preloadSongWaveform(song);
    const duplicate = preloadSongWaveform(song);
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);

    await expect(Promise.all([first, duplicate])).resolves.toEqual([
      expect.objectContaining({ source: 'native', points: expect.any(Array) }),
      expect.objectContaining({ source: 'native', points: expect.any(Array) }),
    ]);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(1);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledWith('file:///preload-song.mp3', 480);
    await expect(getCachedWaveform(getWaveformSourceIdentity(song)))
      .resolves.toMatchObject({ source: 'native' });

    await expect(preloadSongWaveform(song)).resolves.toMatchObject({ source: 'native' });
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(1);
  });

  test('does nothing for a song without a playable URI', async () => {
    await expect(preloadSongWaveform({ id: 'no-uri', title: 'No URI', artist: 'Nobody' }))
      .resolves.toBeNull();
    expect(extractor.extractWaveformPeaks).not.toHaveBeenCalled();
  });

  test('does not decode a known long-form track merely to warm the background cache', async () => {
    await expect(preloadSongWaveform({
      ...song,
      duration: MAX_BACKGROUND_WAVEFORM_PRELOAD_DURATION_MS + 1,
    })).resolves.toBeNull();

    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(extractor.extractWaveformPeaks).not.toHaveBeenCalled();
  });

  test('a best-effort preload failure never suppresses the visible retry', async () => {
    extractor.extractWaveformPeaks
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(decoded);

    const preload = preloadSongWaveform(song);
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    await expect(preload).resolves.toBeNull();

    const foreground = extractNativeWaveform(song, 90_000);
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    await expect(foreground).resolves.toMatchObject({ source: 'native' });
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(2);
  });

  test('retries once behind foreground work that is still in its debounce window', async () => {
    const foregroundSong: Song = {
      ...song,
      id: 'foreground-song',
      uri: 'file:///foreground-song.mp3',
    };
    const foregroundNative = deferred<typeof decoded>();
    extractor.extractWaveformPeaks.mockImplementation((uri: string) =>
      uri.includes('foreground-song') ? foregroundNative.promise : Promise.resolve(decoded));

    const foreground = extractNativeWaveform(foregroundSong, 90_000);
    const preload = preloadSongWaveform(song);
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(1);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledWith(
      'file:///foreground-song.mp3', 480,
    );

    foregroundNative.resolve(decoded);
    await expect(foreground).resolves.toMatchObject({ source: 'native' });
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    await expect(preload).resolves.toMatchObject({ source: 'native' });
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(2);
    expect(extractor.extractWaveformPeaks).toHaveBeenLastCalledWith(
      'file:///preload-song.mp3', 480,
    );
  });
});
