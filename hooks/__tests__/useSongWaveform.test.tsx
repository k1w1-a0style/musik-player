import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import SystemAudio from 'expo-system-audio';
import type { Song } from '../../types/Song';
import { useSongWaveform } from '../useSongWaveform';
import {
  getWaveformFailureBackoff,
  MAX_DETACHED_NATIVE_WAVEFORM_FLIGHTS,
  MAX_WAVEFORM_FAILURE_BACKOFF_ENTRIES,
  recordWaveformFailure,
  resetWaveformExtractionLifecycleForTests,
  WAVEFORM_EXTRACTION_DEBOUNCE_MS,
  WAVEFORM_FAILURE_BACKOFF_MS,
} from '../../utils/waveformExtractionLifecycle';
import {
  getWaveformExtractionKey,
  WAVEFORM_EXTRACTION_TIMEOUT_MS,
} from '../../utils/waveformExtraction';
import { getWaveformSourceKey } from '../../utils/waveformGenerator';
import { resetWaveformCacheStateForTests } from '../../utils/waveformCache';
import {
  preloadSongWaveform,
  resetWaveformPreloadStateForTests,
} from '../../utils/waveformPreload';

type NativeResult = {
  points: number[];
  durationMs?: number;
  analysis?: 'decoded-pcm-v1';
} | null;
const peaks = [0.04, 0.88, 0.12, 0.76, 0.2, 0.92, 0.34, 0.68, 0.16, 0.84];
const decoded = (points = peaks, durationMs?: number): Exclude<NativeResult, null> => ({
  points,
  durationMs,
  analysis: 'decoded-pcm-v1',
});
const song = (id: string): Song => ({ id, title: id, artist: 'Artist', uri: `file:///${id}.mp3` });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const extractor = SystemAudio as typeof SystemAudio & { extractWaveformPeaks: jest.Mock };

const flush = async (ms = 0): Promise<void> => {
  await act(async () => { await jest.advanceTimersByTimeAsync(ms); });
};

describe('useSongWaveform lifecycle', () => {
  beforeEach(async () => {
    resetWaveformExtractionLifecycleForTests();
    resetWaveformCacheStateForTests();
    resetWaveformPreloadStateForTests();
    extractor.extractWaveformPeaks = jest.fn();
    await AsyncStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    resetWaveformExtractionLifecycleForTests();
    resetWaveformCacheStateForTests();
    resetWaveformPreloadStateForTests();
    jest.useRealTimers();
  });

  test('song change aborts A updates/cache and latest B alone becomes visible', async () => {
    const a = deferred<NativeResult>();
    const songA = song('A');
    const songB = song('B');
    extractor.extractWaveformPeaks.mockImplementation((uri: string) => uri.includes('A.mp3') ? a.promise : Promise.resolve(decoded()));
    const onDecision = jest.fn();
    const hook = renderHook<ReturnType<typeof useSongWaveform>, { current: Song }>(
      ({ current }) => useSongWaveform({ song: current, durationMs: 1000, onWaveformDecision: onDecision }),
      { initialProps: { current: songA } },
    );
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    hook.rerender({ current: songB });
    await flush();
    a.resolve(decoded());
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);

    expect(hook.result.current.sourceKey).toBe(getWaveformSourceKey(songB));
    expect(hook.result.current.waveform).toMatchObject({ source: 'native', sourceKey: getWaveformSourceKey(songB) });
    expect(onDecision).not.toHaveBeenCalledWith(expect.objectContaining({ decision: 'native-error' }));
    const keys = [...(AsyncStorage as typeof AsyncStorage & { __getStore(): Map<string, string> }).__getStore().keys()].join('|');
    expect(keys).not.toContain(getWaveformSourceKey(songA));
    expect(keys).toContain(getWaveformSourceKey(songB));
    hook.unmount();
  });

  test('exposes only a loading placeholder until one final waveform is ready', async () => {
    const native = deferred<NativeResult>();
    const currentSong = song('single-visible-shape');
    extractor.extractWaveformPeaks.mockReturnValue(native.promise);

    const hook = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000 }));

    expect(hook.result.current.waveformReady).toBe(false);
    expect(hook.result.current.loadingNative).toBe(true);
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(hook.result.current.waveformReady).toBe(false);

    native.resolve(decoded());
    await flush();

    expect(hook.result.current.waveformReady).toBe(true);
    expect(hook.result.current.loadingNative).toBe(false);
    expect(hook.result.current.waveform.source).toBe('native');
    hook.unmount();
  });

  test('keeps the loading line after native failure and never caches an invented shape', async () => {
    const currentSong = song('stable-fallback');
    extractor.extractWaveformPeaks.mockResolvedValue(null);
    const first = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000 }));

    expect(first.result.current.waveformReady).toBe(false);
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    await flush();
    expect(first.result.current.waveformReady).toBe(false);
    expect(first.result.current.loadingNative).toBe(false);
    expect(first.result.current.waveform.source).toBe('fallback');
    expect((AsyncStorage as typeof AsyncStorage & { __getStore(): Map<string, string> })
      .__getStore().size).toBe(0);
    first.unmount();

    const second = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000 }));
    expect(second.result.current.waveformReady).toBe(false);
    expect(second.result.current.waveform.source).toBe('fallback');
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(1);
    expect(second.result.current.loadingNative).toBe(false);
    second.unmount();
  });

  test('does not restart native extraction when playback duration arrives later', async () => {
    const native = deferred<NativeResult>();
    const currentSong = song('duration-hydration');
    extractor.extractWaveformPeaks.mockReturnValue(native.promise);
    const hook = renderHook<ReturnType<typeof useSongWaveform>, { duration: number }>(
      ({ duration }) => useSongWaveform({ song: currentSong, durationMs: duration }),
      { initialProps: { duration: 0 } },
    );

    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    hook.rerender({ duration: 120_000 });
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(1);

    native.resolve(decoded(peaks, 120_000));
    await flush();
    expect(hook.result.current.waveformReady).toBe(true);
    hook.unmount();
  });

  test('unmount immediately releases the JS waiter without error telemetry', async () => {
    const native = deferred<NativeResult>();
    const currentSong = song('unmount');
    extractor.extractWaveformPeaks.mockReturnValue(native.promise);
    const onDecision = jest.fn();
    const hook = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000, onWaveformDecision: onDecision }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    hook.unmount();
    await flush();
    expect(onDecision).not.toHaveBeenCalledWith(expect.objectContaining({ decision: 'native-error' }));
    expect(jest.getTimerCount()).toBe(0);
    native.resolve(decoded());
    await flush();
  });

  test('timeout releases the waiter once and is reported distinctly', async () => {
    const native = deferred<NativeResult>();
    const currentSong = song('timeout');
    extractor.extractWaveformPeaks.mockReturnValue(native.promise);
    const onDecision = jest.fn();
    const hook = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000, onWaveformDecision: onDecision }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS + WAVEFORM_EXTRACTION_TIMEOUT_MS + 1);
    expect(hook.result.current.loadingNative).toBe(false);
    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith(expect.objectContaining({ decision: 'native-timeout' }));
    hook.unmount();
    native.resolve(null);
    await flush();
  });

  test('same source uses one native flight', async () => {
    const native = deferred<NativeResult>();
    const currentSong = song('shared');
    extractor.extractWaveformPeaks.mockReturnValue(native.promise);
    const first = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000 }));
    const second = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(1);
    native.resolve(decoded());
    await flush();
    expect(first.result.current.waveform.source).toBe('native');
    expect(second.result.current.waveform.source).toBe('native');
    first.unmount();
    second.unmount();
  });

  test('visible waveform preempts a stuck next-track preload', async () => {
    const stuckPreload = deferred<NativeResult>();
    const nextSong = song('next-preload-stuck');
    const currentSong = song('visible-current');
    extractor.extractWaveformPeaks.mockImplementation((uri: string) =>
      uri.includes('next-preload-stuck') ? stuckPreload.promise : Promise.resolve(decoded()));

    const preload = preloadSongWaveform(nextSong);
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledWith(
      'file:///next-preload-stuck.mp3', 160,
    );

    const visible = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);

    expect(extractor.extractWaveformPeaks.mock.calls.map(call => call[0])).toEqual([
      'file:///next-preload-stuck.mp3',
      'file:///visible-current.mp3',
    ]);
    expect(visible.result.current.waveform).toMatchObject({
      source: 'native', sourceKey: getWaveformSourceKey(currentSong),
    });
    await expect(preload).resolves.toBeNull();

    visible.unmount();
    stuckPreload.resolve(null);
    await flush();
  });

  test('stores one canonical detailed waveform while serving each requested display size', async () => {
    const native = deferred<NativeResult>();
    const currentSong = song('shared-different-point-counts');
    extractor.extractWaveformPeaks.mockReturnValue(native.promise);
    const compact = renderHook(() => useSongWaveform({
      song: currentSong,
      durationMs: 1000,
      pointCount: 16,
    }));
    const detailed = renderHook(() => useSongWaveform({
      song: currentSong,
      durationMs: 1000,
      pointCount: 160,
    }));

    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(1);
    expect(extractor.extractWaveformPeaks.mock.calls[0]?.[1]).toBe(160);
    native.resolve(decoded());
    await flush();

    expect(compact.result.current.waveform).toMatchObject({ source: 'native' });
    expect(compact.result.current.waveform.points).toHaveLength(16);
    expect(detailed.result.current.waveform).toMatchObject({ source: 'native' });
    expect(detailed.result.current.waveform.points).toHaveLength(160);
    compact.unmount();
    detailed.unmount();
  });

  test('a superseded queued request never starts after the active flight', async () => {
    const active = deferred<NativeResult>();
    const activeSong = song('active');
    const staleSong = song('stale');
    const latestSong = song('latest');
    extractor.extractWaveformPeaks.mockImplementation((uri: string) => uri.includes('active') ? active.promise : Promise.resolve(decoded()));
    const first = renderHook(() => useSongWaveform({ song: activeSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    const stale = renderHook(() => useSongWaveform({ song: staleSong, durationMs: 1000 }));
    await flush();
    const latest = renderHook(() => useSongWaveform({ song: latestSong, durationMs: 1000 }));
    await flush();
    active.resolve(decoded());
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(extractor.extractWaveformPeaks.mock.calls.map(call => call[0])).toEqual([
      'file:///active.mp3',
      'file:///latest.mp3',
    ]);
    first.unmount();
    stale.unmount();
    latest.unmount();
  });

  test('active settlement never bypasses the latest request debounce window', async () => {
    const active = deferred<NativeResult>();
    const activeSong = song('active-debounce');
    const middleSong = song('middle-debounce');
    const latestSong = song('latest-debounce');
    extractor.extractWaveformPeaks.mockImplementation((uri: string) =>
      uri.includes('active-debounce') ? active.promise : Promise.resolve(decoded()));

    const first = renderHook(() => useSongWaveform({ song: activeSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    const middle = renderHook(() => useSongWaveform({ song: middleSong, durationMs: 1000 }));
    await flush(40);
    active.resolve(decoded());
    await flush();
    expect(extractor.extractWaveformPeaks.mock.calls.map(call => call[0])).toEqual(['file:///active-debounce.mp3']);

    const latest = renderHook(() => useSongWaveform({ song: latestSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS - 1);
    expect(extractor.extractWaveformPeaks.mock.calls.map(call => call[0])).toEqual(['file:///active-debounce.mp3']);
    await flush(1);
    expect(extractor.extractWaveformPeaks.mock.calls.map(call => call[0])).toEqual([
      'file:///active-debounce.mp3',
      'file:///latest-debounce.mp3',
    ]);

    first.unmount();
    middle.unmount();
    latest.unmount();
  });

  test('a non-settling timed-out native call does not block the next song', async () => {
    const stuck = deferred<NativeResult>();
    const stuckSong = song('stuck-one');
    const afterSong = song('after-stuck');
    extractor.extractWaveformPeaks.mockImplementation((uri: string) =>
      uri.includes('stuck-one') ? stuck.promise : Promise.resolve(decoded()));

    const first = renderHook(() => useSongWaveform({ song: stuckSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS + WAVEFORM_EXTRACTION_TIMEOUT_MS + 1);
    expect(first.result.current.loadingNative).toBe(false);

    const second = renderHook(() => useSongWaveform({ song: afterSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(extractor.extractWaveformPeaks.mock.calls.map(call => call[0])).toEqual([
      'file:///stuck-one.mp3',
      'file:///after-stuck.mp3',
    ]);
    expect(second.result.current.waveform).toMatchObject({ source: 'native' });

    first.unmount();
    second.unmount();
    stuck.resolve(null);
    await flush();
  });

  test('circuit capacity keeps a line and retries when native capacity recovers', async () => {
    const firstNative = deferred<NativeResult>();
    const secondNative = deferred<NativeResult>();
    const firstSong = song('circuit-one');
    const secondSong = song('circuit-two');
    const blockedSong = song('circuit-blocked');
    extractor.extractWaveformPeaks.mockImplementation((uri: string) => {
      if (uri.includes('circuit-one')) return firstNative.promise;
      if (uri.includes('circuit-two')) return secondNative.promise;
      return Promise.resolve(decoded());
    });

    const first = renderHook(() => useSongWaveform({ song: firstSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS + WAVEFORM_EXTRACTION_TIMEOUT_MS + 1);
    const second = renderHook(() => useSongWaveform({ song: secondSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS + WAVEFORM_EXTRACTION_TIMEOUT_MS + 1);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(MAX_DETACHED_NATIVE_WAVEFORM_FLIGHTS);

    const onDecision = jest.fn();
    const blocked = renderHook(() => useSongWaveform({ song: blockedSong, durationMs: 1000, onWaveformDecision: onDecision }));
    await flush();
    expect(blocked.result.current.loadingNative).toBe(false);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(MAX_DETACHED_NATIVE_WAVEFORM_FLIGHTS);
    expect(onDecision).toHaveBeenCalledWith(expect.objectContaining({ decision: 'native-scheduler-unavailable' }));
    expect(getWaveformFailureBackoff(getWaveformExtractionKey(blockedSong))).toBeNull();
    blocked.unmount();

    firstNative.resolve(decoded());
    await flush();
    const recovered = renderHook(() => useSongWaveform({ song: blockedSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(extractor.extractWaveformPeaks)
      .toHaveBeenCalledTimes(MAX_DETACHED_NATIVE_WAVEFORM_FLIGHTS + 1);
    expect(recovered.result.current.waveform).toMatchObject({ source: 'native' });
    expect(recovered.result.current.waveformReady).toBe(true);

    first.unmount();
    second.unmount();
    recovered.unmount();
    secondNative.resolve(null);
    await flush();
  });

  test('lifecycle reset prevents an old native finalizer from starting a new request early', async () => {
    const stale = deferred<NativeResult>();
    const staleSong = song('reset-stale');
    const nextSong = song('reset-next');
    extractor.extractWaveformPeaks.mockImplementation((uri: string) =>
      uri.includes('reset-stale') ? stale.promise : Promise.resolve(decoded()));

    const first = renderHook(() => useSongWaveform({ song: staleSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    first.unmount();
    resetWaveformExtractionLifecycleForTests();

    const next = renderHook(() => useSongWaveform({ song: nextSong, durationMs: 1000 }));
    stale.resolve(decoded());
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS - 1);
    expect(extractor.extractWaveformPeaks.mock.calls.map(call => call[0])).toEqual(['file:///reset-stale.mp3']);
    await flush(1);
    expect(extractor.extractWaveformPeaks.mock.calls.map(call => call[0])).toEqual([
      'file:///reset-stale.mp3',
      'file:///reset-next.mp3',
    ]);
    next.unmount();
  });

  test('failed result stays a line during backoff and retries afterward', async () => {
    const currentSong = song('bad');
    extractor.extractWaveformPeaks.mockResolvedValue({ points: [] });
    const first = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    first.unmount();
    const blocked = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(1);
    blocked.unmount();
    await flush(WAVEFORM_FAILURE_BACKOFF_MS);
    const retry = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(2);
    expect(retry.result.current.waveform).toMatchObject({ source: 'fallback' });
    expect(retry.result.current.waveformReady).toBe(false);
    expect(retry.result.current.loadingNative).toBe(false);
    retry.unmount();
  });

  test('failure backoff map evicts its oldest entry at the configured bound', () => {
    for (let index = 0; index <= MAX_WAVEFORM_FAILURE_BACKOFF_ENTRIES; index += 1) {
      recordWaveformFailure(`failure-${index}`, 'native-error');
    }

    expect(getWaveformFailureBackoff('failure-0')).toBeNull();
    expect(getWaveformFailureBackoff('failure-1')).toBe('native-error');
    expect(getWaveformFailureBackoff(`failure-${MAX_WAVEFORM_FAILURE_BACKOFF_ENTRIES}`)).toBe('native-error');
  });

  test('successful native cache entry prevents extraction on revisit', async () => {
    const currentSong = song('cached');
    extractor.extractWaveformPeaks.mockResolvedValue(decoded());
    const first = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    first.unmount();
    const second = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000 }));
    await flush();
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(1);
    second.unmount();
  });
});
