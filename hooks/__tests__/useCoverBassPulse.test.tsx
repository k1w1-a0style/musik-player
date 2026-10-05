import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { useProgress } from 'react-native-track-player';
import { useCoverBassPulse } from '../useCoverBassPulse';
import { getCachedWaveformForSong } from '../../utils/waveformSourceCache';
import { setCachedWaveform } from '../../utils/waveformCache';
import { extractNativeWaveform } from '../../utils/waveformExtraction';
import { isSongPrepared } from '../../utils/songPreparation';
import { setWaveformStatus } from '../../utils/waveformStatus';
import { buildNativeWaveform, getWaveformSourceIdentity } from '../../utils/waveformGenerator';
import type { Song } from '../../types/Song';

jest.mock('../../utils/waveformSourceCache', () => ({ getCachedWaveformForSong: jest.fn() }));
jest.mock('../../utils/waveformCache', () => ({ setCachedWaveform: jest.fn() }));
jest.mock('../../utils/waveformExtraction', () => ({ extractNativeWaveform: jest.fn() }));
jest.mock('../../utils/songPreparation', () => ({ isSongPrepared: jest.fn() }));
jest.mock('../../utils/waveformStatus', () => ({ setWaveformStatus: jest.fn() }));

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
  jest.mocked(isSongPrepared).mockReturnValue(true);
  jest.mocked(useProgress).mockReturnValue({ position: 0.5, duration: 1, buffered: 1 });
  frames = [];
  jest.spyOn(Animated, 'timing').mockImplementation((_value, config) => {
    frames.push(config.toValue as number);
    return { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
  });
});
afterEach(() => jest.restoreAllMocks());

test('drives visible native cover frames from bass at the real playback position and resets on pause', async () => {
  const scale = new Animated.Value(1);
  const view = renderHook(({ playing }: { playing: boolean }) => useCoverBassPulse(song, playing, scale), { initialProps: { playing: true } });
  await waitFor(() => expect(frames.some(value => value >= 1.03)).toBe(true));
  expect(decode).not.toHaveBeenCalled();
  expect(useProgress).toHaveBeenCalledWith(250);
  expect(Animated.timing).toHaveBeenCalledWith(scale, expect.objectContaining({
    duration: 50, useNativeDriver: true, isInteraction: false,
  }));
  frames = [];
  jest.mocked(useProgress).mockReturnValue({ position: 0, duration: 1, buffered: 1 });
  view.rerender({ playing: true });
  expect(frames.every(value => value === 1)).toBe(true);
  scale.setValue(1.08);
  view.rerender({ playing: false });
  expect((scale as Animated.Value & { __getValue(): number }).__getValue()).toBe(1);
});

test('upgrades a legacy cache with foreground priority only when that track is playing', async () => {
  const legacy = { ...envelope(), bassPoints: undefined };
  cache.mockResolvedValue(legacy);
  const scale = new Animated.Value(1);
  const view = renderHook(({ playing }: { playing: boolean }) => useCoverBassPulse(song, playing, scale), { initialProps: { playing: false } });
  await waitFor(() => expect(cache).toHaveBeenCalledWith(song));
  expect(decode).not.toHaveBeenCalled();
  view.rerender({ playing: true });
  await waitFor(() => expect(setCachedWaveform).toHaveBeenCalledWith(expect.objectContaining({ bassPoints: envelope().bassPoints })));
  expect(decode).toHaveBeenCalledWith(song, 1000, expect.objectContaining({ priority: 'foreground' }));
  expect(frames.some(value => value >= 1.03)).toBe(true);
});

test.each(['missing', 'failed'] as const)('keeps a previously prepared track ready when optional bass decoding is %s', async failure => {
  cache.mockResolvedValue(null);
  if (failure === 'failed') decode.mockRejectedValue(new Error('decoder unavailable'));
  else decode.mockResolvedValue(null);
  const scale = new Animated.Value(1);
  renderHook(() => useCoverBassPulse(song, true, scale));
  await waitFor(() => expect(setWaveformStatus).toHaveBeenCalledWith(getWaveformSourceIdentity(song).sourceFingerprint, 'ready'));
  expect((scale as Animated.Value & { __getValue(): number }).__getValue()).toBe(1);
  expect(setCachedWaveform).not.toHaveBeenCalled();
});

test('aborts a legacy upgrade on track change and ignores its late result', async () => {
  cache.mockResolvedValue(null);
  let finish!: (value: ReturnType<typeof envelope>) => void;
  decode.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const scale = new Animated.Value(1);
  const view = renderHook(({ selected }: { selected: Song }) => useCoverBassPulse(selected, true, scale), { initialProps: { selected: song } });
  await waitFor(() => expect(decode).toHaveBeenCalledTimes(1));
  const signal = decode.mock.calls[0][2]?.signal;
  const second = { ...song, id: 'second', uri: 'file:///second.mp3' };
  cache.mockResolvedValue(envelope(second));
  view.rerender({ selected: second });
  expect(signal?.aborted).toBe(true);
  await act(async () => finish(envelope()));
  expect(setCachedWaveform).not.toHaveBeenCalled();
  expect(setWaveformStatus).not.toHaveBeenCalled();
});

test('ignores a late cache read after unmount and does not scan a missing track', async () => {
  let finish!: (value: ReturnType<typeof envelope>) => void;
  cache.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const scale = new Animated.Value(1);
  const view = renderHook(() => useCoverBassPulse(song, true, scale));
  view.unmount();
  await act(async () => finish(envelope()));
  expect(decode).not.toHaveBeenCalled();
  expect(frames).toEqual([]);
  renderHook(() => useCoverBassPulse(null, true, scale));
  expect(cache).toHaveBeenCalledTimes(1);
});
