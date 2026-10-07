import React, { type PropsWithChildren } from 'react';
import { PlaybackProgressProvider } from '../../contexts/PlaybackProgressContext';
import { act, renderHook as renderProgressHook, waitFor } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { useProgress } from 'react-native-track-player';
import { useCoverBassPulse } from '../useCoverBassPulse';
import { getCachedWaveformForSong } from '../../utils/waveformSourceCache';
import { setCachedWaveform } from '../../utils/waveformCache';
import { extractNativeWaveform } from '../../utils/waveformExtraction';
import { setWaveformStatus } from '../../utils/waveformStatus';
import { buildNativeWaveform, getWaveformSourceIdentity } from '../../utils/waveformGenerator';
import type { Song } from '../../types/Song';

jest.mock('../../utils/waveformSourceCache', () => ({ getCachedWaveformForSong: jest.fn() }));
jest.mock('../../utils/waveformCache', () => ({ setCachedWaveform: jest.fn() }));
jest.mock('../../utils/waveformExtraction', () => ({ extractNativeWaveform: jest.fn() }));
jest.mock('../../utils/waveformStatus', () => ({ setWaveformStatus: jest.fn(), getWaveformStatus: jest.fn(() => 'ready'),
  subscribeWaveformStatus: jest.fn(() => () => undefined) }));

const ProgressWrapper = ({ children }: PropsWithChildren) => <PlaybackProgressProvider>{children}</PlaybackProgressProvider>;
const renderHook: typeof renderProgressHook = (callback, options) => renderProgressHook(callback, { ...options, wrapper: ProgressWrapper });

const song: Song = { id: 'bass', title: 'Bass', artist: 'Artist', uri: 'file:///bass.mp3', duration: 1000 };
const envelope = (selected: Song = song) => buildNativeWaveform(selected, {
  points: [0.1, 0.8, 0.2, 0.9, 0.1, 0.7, 0.3, 0.5],
  bassPoints: [...Array(10).fill(0), ...Array(10).fill(0.35)], analysis: 'decoded-pcm-v1',
}, 1000, 1024);
const cache = jest.mocked(getCachedWaveformForSong);
const decode = jest.mocked(extractNativeWaveform);
let frames: number[];

beforeEach(() => {
  jest.clearAllMocks();
  cache.mockResolvedValue(envelope());
  decode.mockResolvedValue(envelope());
  jest.mocked(useProgress).mockReturnValue({ position: 0.5, duration: 1, buffered: 1 });
  frames = [];
  jest.spyOn(Animated, 'timing').mockImplementation((_value, config) => {
    frames.push(config.toValue as number);
    return { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
  });
});
afterEach(() => jest.restoreAllMocks());

const valueOf = (scale: ReturnType<typeof useCoverBassPulse>) =>
  (scale as typeof scale & { __getValue(): number }).__getValue();

test('drives the complete native bass curve between clock samples and resets on pause', async () => {
  const view = renderHook(({ playing }: { playing: boolean }) => useCoverBassPulse(song, playing), { initialProps: { playing: true } });
  await waitFor(() => expect(valueOf(view.result.current)).toBeGreaterThan(1.03));
  expect(decode).not.toHaveBeenCalled();
  expect(useProgress).toHaveBeenCalledWith(500);
  expect(useProgress).toHaveBeenCalledTimes(1);
  expect(Animated.timing).toHaveBeenCalledWith(expect.any(Animated.Value), expect.objectContaining({
    useNativeDriver: true, isInteraction: false,
  }));
  const [nativeClock] = jest.mocked(Animated.timing).mock.calls.at(-1)!;
  // The native driver advances this value without React/JS beat callbacks.
  act(() => (nativeClock as Animated.Value).setValue(250));
  expect(valueOf(view.result.current)).toBe(1);
  act(() => (nativeClock as Animated.Value).setValue(650));
  expect(valueOf(view.result.current)).toBeGreaterThan(1.03);
  view.rerender({ playing: false });
  expect(valueOf(view.result.current)).toBe(1);
});

test('upgrades a legacy cache with foreground priority only when that track is playing', async () => {
  const legacy = { ...envelope(), bassPoints: undefined };
  cache.mockResolvedValue(legacy);
  const view = renderHook(({ playing }: { playing: boolean }) => useCoverBassPulse(song, playing), { initialProps: { playing: false } });
  await waitFor(() => expect(cache).toHaveBeenCalledWith(song));
  expect(decode).not.toHaveBeenCalled();
  view.rerender({ playing: true });
  await waitFor(() => expect(setCachedWaveform).toHaveBeenCalledWith(expect.objectContaining({ bassPoints: envelope().bassPoints })));
  expect(decode).toHaveBeenCalledWith(song, 1000, expect.objectContaining({ priority: 'foreground' }));
  expect(valueOf(view.result.current)).toBeGreaterThan(1.03);
});

test.each(['missing', 'failed'] as const)('keeps an actually cached waveform ready when optional bass decoding is %s', async failure => {
  cache.mockResolvedValue({ ...envelope(), bassPoints: undefined });
  if (failure === 'failed') decode.mockRejectedValue(new Error('decoder unavailable'));
  else decode.mockResolvedValue(null);
  const view = renderHook(() => useCoverBassPulse(song, true));
  await waitFor(() => expect(setWaveformStatus).toHaveBeenCalledWith(getWaveformSourceIdentity(song).sourceFingerprint, 'ready'));
  expect(valueOf(view.result.current)).toBe(1);
  expect(setCachedWaveform).not.toHaveBeenCalled();
});

test('aborts a legacy upgrade on track change and ignores its late result', async () => {
  cache.mockResolvedValue({ ...envelope(), bassPoints: undefined });
  let finish!: (value: ReturnType<typeof envelope>) => void;
  decode.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = renderHook(({ selected }: { selected: Song }) => useCoverBassPulse(selected, true), { initialProps: { selected: song } });
  await waitFor(() => expect(decode).toHaveBeenCalledTimes(1));
  const signal = decode.mock.calls[0][2]?.signal;
  const second = { ...song, id: 'second', uri: 'file:///second.mp3' };
  cache.mockResolvedValue(envelope(second));
  view.rerender({ selected: second });
  expect(signal?.aborted).toBe(true);
  await act(async () => finish(envelope()));
  expect(setCachedWaveform).not.toHaveBeenCalled();
  expect(setWaveformStatus).toHaveBeenCalledWith(getWaveformSourceIdentity(song).sourceFingerprint, 'ready');
  expect(setWaveformStatus).not.toHaveBeenCalledWith(getWaveformSourceIdentity(second).sourceFingerprint, 'ready');
});

test('ignores a late cache read after unmount and does not scan a missing track', async () => {
  let finish!: (value: ReturnType<typeof envelope>) => void;
  cache.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = renderHook(() => useCoverBassPulse(song, true));
  view.unmount();
  await act(async () => finish(envelope()));
  expect(decode).not.toHaveBeenCalled();
  expect(frames).toEqual([]);
  renderHook(() => useCoverBassPulse(null, true));
  expect(cache).toHaveBeenCalledTimes(1);
});
