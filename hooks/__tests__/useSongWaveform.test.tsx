import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import SystemAudio from 'expo-system-audio';
import type { Song } from '../../types/Song';
import { useSongWaveform } from '../useSongWaveform';
import {
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
