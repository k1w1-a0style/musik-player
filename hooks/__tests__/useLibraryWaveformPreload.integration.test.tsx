import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import SystemAudio from 'expo-system-audio';
import { AppState, InteractionManager } from 'react-native';
import type { Song } from '../../types/Song';
import { getCachedWaveform, resetWaveformCacheStateForTests } from '../../utils/waveformCache';
import { extractNativeWaveform } from '../../utils/waveformExtraction';
import { resetWaveformExtractionLifecycleForTests } from '../../utils/waveformExtractionLifecycle';
import { getWaveformSourceIdentity } from '../../utils/waveformGenerator';
import { useLibraryWaveformPreload } from '../useLibraryWaveformPreload';

const librarySong: Song = { id: 'library', title: 'Library', artist: 'CI', uri: 'file:///library.mp3', duration: 60000 };
const foregroundSong: Song = { ...librarySong, id: 'foreground', uri: 'file:///foreground.mp3' };
const songs = [librarySong];
const decoded = { points: [0.1, 0.8, 0.2, 0.7, 0.3, 0.9, 0.4, 0.6], analysis: 'decoded-pcm-v1' as const };
type NativeResult = typeof decoded | null;
const native = SystemAudio as unknown as {
  extractWaveformPeaks: jest.Mock;
  hasNativeWaveformCancellation: boolean;
  cancelWaveformExtraction: jest.Mock;
};
const flush = async (ms: number) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };

beforeEach(async () => {
  jest.useFakeTimers();
  resetWaveformExtractionLifecycleForTests();
  resetWaveformCacheStateForTests();
  await AsyncStorage.clear();
  native.extractWaveformPeaks = jest.fn().mockResolvedValue(decoded);
  native.hasNativeWaveformCancellation = true;
  native.cancelWaveformExtraction = jest.fn().mockReturnValue(true);
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation(callback => {
    if (typeof callback === 'function') callback();
    return { cancel: jest.fn(), then: jest.fn(), done: jest.fn() } as never;
  });
});

afterEach(() => {
  resetWaveformExtractionLifecycleForTests();
  resetWaveformCacheStateForTests();
  native.hasNativeWaveformCancellation = false;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each(['queued', 'preempted'] as const)('resumes %s library work without a songs change after foreground work finishes', async phase => {
  let finishBackground!: (value: NativeResult) => void;
  if (phase === 'preempted') {
    native.extractWaveformPeaks.mockImplementationOnce(() => new Promise(resolve => { finishBackground = resolve; }));
    native.cancelWaveformExtraction.mockImplementation(() => { finishBackground(null); return true; });
  }
  const hook = renderHook(() => useLibraryWaveformPreload(songs, true));
  await flush(phase === 'queued' ? 1490 : 1620);
  const foreground = extractNativeWaveform(foregroundSong, 60000);
  await flush(120);
  expect(await foreground).toMatchObject({ source: 'native' });
  await flush(1700);

  expect(await getCachedWaveform(getWaveformSourceIdentity(librarySong))).toMatchObject({ source: 'native' });
  expect(native.extractWaveformPeaks.mock.calls.filter(([uri]) => uri === librarySong.uri))
    .toHaveLength(phase === 'queued' ? 1 : 2);
  hook.unmount();
});

test('disabling idle work cancels its deferred retry before any library decode starts', async () => {
  const hook = renderHook<void, { enabled: boolean }>(({ enabled }) => useLibraryWaveformPreload(songs, enabled), {
    initialProps: { enabled: true },
  });
  await flush(1490);
  const foreground = extractNativeWaveform(foregroundSong, 60000);
  await flush(120);
  await foreground;
  hook.rerender({ enabled: false });
  await flush(5000);
  expect(native.extractWaveformPeaks.mock.calls.map(([uri]) => uri)).toEqual([foregroundSong.uri]);
  hook.unmount();
});

test('a real decoder failure is attempted once instead of polling indefinitely', async () => {
  native.extractWaveformPeaks.mockResolvedValue(null);
  const hook = renderHook(() => useLibraryWaveformPreload(songs, true));
  await flush(10000);
  expect(native.extractWaveformPeaks).toHaveBeenCalledTimes(1);
  expect(await getCachedWaveform(getWaveformSourceIdentity(librarySong))).toBeNull();
  hook.unmount();
});

test('metadata backfill preserves a running native preload', async () => {
  let finish!: (value: NativeResult) => void;
  native.extractWaveformPeaks.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  native.cancelWaveformExtraction.mockImplementation(() => { finish(null); return true; });
  const hook = renderHook<void, { current: Song[] }>(
    ({ current }) => useLibraryWaveformPreload(current, true), { initialProps: { current: songs } },
  );
  await flush(1620);
  expect(native.extractWaveformPeaks).toHaveBeenCalledTimes(1);
  const enriched = { ...librarySong, duration: 61000, audioInfo: { durationMs: 61000 }, title: 'Updated', cover: 'file:///cover.jpg' };
  hook.rerender({ current: [enriched] });
  await flush(2000);
  expect(native.cancelWaveformExtraction).not.toHaveBeenCalled();
  expect(native.extractWaveformPeaks).toHaveBeenCalledTimes(1);
  finish(decoded);
  await flush(2000);
  expect(await getCachedWaveform(getWaveformSourceIdentity(enriched))).toMatchObject({ source: 'native' });
  expect(native.extractWaveformPeaks).toHaveBeenCalledTimes(1);
  hook.unmount();
});

test('newly discovered duration wakes an idle preloader', async () => {
  const hook = renderHook<void, { current: Song[] }>(
    ({ current }) => useLibraryWaveformPreload(current, true),
    { initialProps: { current: [{ ...librarySong, duration: undefined }] } },
  );
  await flush(3000);
  expect(native.extractWaveformPeaks).not.toHaveBeenCalled();
  hook.rerender({ current: songs });
  await flush(1620);
  expect(native.extractWaveformPeaks).toHaveBeenCalledTimes(1);
  expect(await getCachedWaveform(getWaveformSourceIdentity(librarySong))).toMatchObject({ source: 'native' });
  hook.unmount();
});

test('a changed physical source cancels the old decoder and prepares the replacement', async () => {
  let finish!: (value: NativeResult) => void;
  native.extractWaveformPeaks.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  native.cancelWaveformExtraction.mockImplementation(() => { finish(null); return true; });
  const hook = renderHook<void, { current: Song[] }>(
    ({ current }) => useLibraryWaveformPreload(current, true), { initialProps: { current: songs } },
  );
  await flush(1620);
  const changed = { ...librarySong, uri: 'file:///replacement.mp3' };
  hook.rerender({ current: [changed] });
  await flush(1700);
  expect(native.cancelWaveformExtraction).toHaveBeenCalledTimes(1);
  expect(native.extractWaveformPeaks.mock.calls.map(([uri]) => uri)).toEqual([librarySong.uri, changed.uri]);
  expect(await getCachedWaveform(getWaveformSourceIdentity(changed))).toMatchObject({ source: 'native' });
  expect(await getCachedWaveform(getWaveformSourceIdentity(librarySong))).toBeNull();
  hook.unmount();
});

test('new duration queues a follow-up pass without cancelling another active track', async () => {
  let finish!: (value: NativeResult) => void;
  const unknown: Song = { id: 'unknown', title: 'Unknown', artist: 'CI', uri: 'file:///unknown.mp3' };
  native.extractWaveformPeaks.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  native.cancelWaveformExtraction.mockImplementation(() => { finish(null); return true; });
  const hook = renderHook<void, { current: Song[] }>(
    ({ current }) => useLibraryWaveformPreload(current, true),
    { initialProps: { current: [unknown, librarySong] } },
  );
  await flush(1620);
  const enriched = { ...unknown, duration: 60000 };
  hook.rerender({ current: [enriched, librarySong] });
  await flush(2000);
  expect(native.cancelWaveformExtraction).not.toHaveBeenCalled();
  expect(native.extractWaveformPeaks).toHaveBeenCalledTimes(1);
  finish(decoded);
  await flush(1700);
  expect(native.extractWaveformPeaks.mock.calls.map(([uri]) => uri)).toEqual([librarySong.uri, unknown.uri]);
  expect(await getCachedWaveform(getWaveformSourceIdentity(enriched))).toMatchObject({ source: 'native' });
  hook.unmount();
});
