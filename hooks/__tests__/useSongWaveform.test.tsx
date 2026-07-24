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
import { WAVEFORM_EXTRACTION_TIMEOUT_MS } from '../../utils/waveformExtraction';
import { getWaveformSourceKey } from '../../utils/waveformGenerator';

type NativeResult = { points: number[]; durationMs?: number } | null;
const peaks = [0.04, 0.88, 0.12, 0.76, 0.2, 0.92, 0.34, 0.68, 0.16, 0.84];
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
    extractor.extractWaveformPeaks = jest.fn();
    await AsyncStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    resetWaveformExtractionLifecycleForTests();
    jest.useRealTimers();
  });

  test('song change aborts A updates/cache and latest B alone becomes visible', async () => {
    const a = deferred<NativeResult>();
    extractor.extractWaveformPeaks.mockImplementation((uri: string) => uri.includes('A.mp3') ? a.promise : Promise.resolve({ points: peaks }));
    const onDecision = jest.fn();
    const { result, rerender } = renderHook<ReturnType<typeof useSongWaveform>, { current: Song }>(
      ({ current }) => useSongWaveform({ song: current, durationMs: 1000, onWaveformDecision: onDecision }),
      { initialProps: { current: song('A') } as { current: Song } },
    );
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    rerender({ current: song('B') });
    await flush();
    a.resolve({ points: peaks });
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);

    expect(result.current.sourceKey).toBe(getWaveformSourceKey(song('B')));
    expect(result.current.waveform).toMatchObject({ source: 'native', sourceKey: getWaveformSourceKey(song('B')) });
    expect(onDecision).not.toHaveBeenCalledWith(expect.objectContaining({ decision: 'native-error' }));
    const keys = [...(AsyncStorage as typeof AsyncStorage & { __getStore(): Map<string, string> }).__getStore().keys()].join('|');
    expect(keys).not.toContain(getWaveformSourceKey(song('A')));
    expect(keys).toContain(getWaveformSourceKey(song('B')));
  });

  test('unmount immediately releases the JS waiter without error telemetry', async () => {
    const native = deferred<NativeResult>();
    const currentSong = song('unmount');
    extractor.extractWaveformPeaks.mockReturnValue(native.promise);
    const onDecision = jest.fn();
    const { unmount } = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000, onWaveformDecision: onDecision }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    unmount();
    await flush();
    expect(onDecision).not.toHaveBeenCalledWith(expect.objectContaining({ decision: 'native-error' }));
    expect(jest.getTimerCount()).toBe(0);
    native.resolve({ points: peaks });
  });

  test('timeout releases the waiter once and is reported distinctly', async () => {
    const currentSong = song('timeout');
    extractor.extractWaveformPeaks.mockReturnValue(new Promise(() => undefined));
    const onDecision = jest.fn();
    const { result } = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000, onWaveformDecision: onDecision }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS + WAVEFORM_EXTRACTION_TIMEOUT_MS + 1);
    expect(result.current.loadingNative).toBe(false);
    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith(expect.objectContaining({ decision: 'native-timeout' }));
  });

  test('same source uses one native flight', async () => {
    const native = deferred<NativeResult>();
    const currentSong = song('shared');
    extractor.extractWaveformPeaks.mockReturnValue(native.promise);
    const first = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000 }));
    const second = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(1);
    native.resolve({ points: peaks });
    await flush();
    expect(first.result.current.waveform.source).toBe('native');
    expect(second.result.current.waveform.source).toBe('native');
  });

  test('a superseded queued request never starts after the active flight', async () => {
    const active = deferred<NativeResult>();
    const activeSong = song('active');
    const staleSong = song('stale');
    const latestSong = song('latest');
    extractor.extractWaveformPeaks.mockImplementation((uri: string) => uri.includes('active') ? active.promise : Promise.resolve({ points: peaks }));
    const first = renderHook(() => useSongWaveform({ song: activeSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    const stale = renderHook(() => useSongWaveform({ song: staleSong, durationMs: 1000 }));
    await flush();
    const latest = renderHook(() => useSongWaveform({ song: latestSong, durationMs: 1000 }));
    await flush();
    active.resolve({ points: peaks });
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(extractor.extractWaveformPeaks.mock.calls.map(call => call[0])).toEqual([
      'file:///active.mp3',
      'file:///latest.mp3',
    ]);
    first.unmount(); stale.unmount(); latest.unmount();
  });

  test('active settlement never bypasses the latest request debounce window', async () => {
    const active = deferred<NativeResult>();
    extractor.extractWaveformPeaks.mockImplementation((uri: string) =>
      uri.includes('active-debounce') ? active.promise : Promise.resolve({ points: peaks }));

    const first = renderHook(() => useSongWaveform({ song: song('active-debounce'), durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    const middle = renderHook(() => useSongWaveform({ song: song('middle-debounce'), durationMs: 1000 }));
    await flush(40);
    active.resolve({ points: peaks });
    await flush();
    expect(extractor.extractWaveformPeaks.mock.calls.map(call => call[0])).toEqual(['file:///active-debounce.mp3']);

    const latest = renderHook(() => useSongWaveform({ song: song('latest-debounce'), durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS - 1);
    expect(extractor.extractWaveformPeaks.mock.calls.map(call => call[0])).toEqual(['file:///active-debounce.mp3']);
    await flush(1);
    expect(extractor.extractWaveformPeaks.mock.calls.map(call => call[0])).toEqual([
      'file:///active-debounce.mp3',
      'file:///latest-debounce.mp3',
    ]);

    first.unmount(); middle.unmount(); latest.unmount();
  });

  test('a non-settling timed-out native call does not block the next song', async () => {
    const stuck = deferred<NativeResult>();
    extractor.extractWaveformPeaks.mockImplementation((uri: string) =>
      uri.includes('stuck-one') ? stuck.promise : Promise.resolve({ points: peaks }));

    const first = renderHook(() => useSongWaveform({ song: song('stuck-one'), durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS + WAVEFORM_EXTRACTION_TIMEOUT_MS + 1);
    expect(first.result.current.loadingNative).toBe(false);

    const second = renderHook(() => useSongWaveform({ song: song('after-stuck'), durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(extractor.extractWaveformPeaks.mock.calls.map(call => call[0])).toEqual([
      'file:///stuck-one.mp3',
      'file:///after-stuck.mp3',
    ]);
    expect(second.result.current.waveform).toMatchObject({ source: 'native' });

    first.unmount(); second.unmount();
  });

  test('two orphaned native calls open a bounded fail-fast circuit until one settles', async () => {
    const firstNative = deferred<NativeResult>();
    const secondNative = deferred<NativeResult>();
    extractor.extractWaveformPeaks.mockImplementation((uri: string) => {
      if (uri.includes('circuit-one')) return firstNative.promise;
      if (uri.includes('circuit-two')) return secondNative.promise;
      return Promise.resolve({ points: peaks });
    });

    const first = renderHook(() => useSongWaveform({ song: song('circuit-one'), durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS + WAVEFORM_EXTRACTION_TIMEOUT_MS + 1);
    const second = renderHook(() => useSongWaveform({ song: song('circuit-two'), durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS + WAVEFORM_EXTRACTION_TIMEOUT_MS + 1);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(MAX_DETACHED_NATIVE_WAVEFORM_FLIGHTS);

    const onDecision = jest.fn();
    const blocked = renderHook(() => useSongWaveform({ song: song('circuit-blocked'), durationMs: 1000, onWaveformDecision: onDecision }));
    await flush();
    expect(blocked.result.current.loadingNative).toBe(false);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(MAX_DETACHED_NATIVE_WAVEFORM_FLIGHTS);
    expect(onDecision).toHaveBeenCalledWith(expect.objectContaining({ decision: 'native-error' }));

    firstNative.resolve({ points: peaks });
    await flush();
    const recovered = renderHook(() => useSongWaveform({ song: song('circuit-recovered'), durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(MAX_DETACHED_NATIVE_WAVEFORM_FLIGHTS + 1);
    expect(recovered.result.current.waveform).toMatchObject({ source: 'native' });

    first.unmount(); second.unmount(); blocked.unmount(); recovered.unmount();
  });

  test('lifecycle reset prevents an old native finalizer from starting a new request early', async () => {
    const stale = deferred<NativeResult>();
    extractor.extractWaveformPeaks.mockImplementation((uri: string) =>
      uri.includes('reset-stale') ? stale.promise : Promise.resolve({ points: peaks }));

    const first = renderHook(() => useSongWaveform({ song: song('reset-stale'), durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    first.unmount();
    resetWaveformExtractionLifecycleForTests();

    const next = renderHook(() => useSongWaveform({ song: song('reset-next'), durationMs: 1000 }));
    stale.resolve({ points: peaks });
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS - 1);
    expect(extractor.extractWaveformPeaks.mock.calls.map(call => call[0])).toEqual(['file:///reset-stale.mp3']);
    await flush(1);
    expect(extractor.extractWaveformPeaks.mock.calls.map(call => call[0])).toEqual([
      'file:///reset-stale.mp3',
      'file:///reset-next.mp3',
    ]);
    next.unmount();
  });

  test('failed result backs off, then permits a retry after the bounded interval', async () => {
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
    renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(2);
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
    extractor.extractWaveformPeaks.mockResolvedValue({ points: peaks });
    const first = renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000 }));
    await flush(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    first.unmount();
    renderHook(() => useSongWaveform({ song: currentSong, durationMs: 1000 }));
    await flush();
    expect(extractor.extractWaveformPeaks).toHaveBeenCalledTimes(1);
  });
});
