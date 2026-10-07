import { act, renderHook } from '@testing-library/react-native';
import { AppState, InteractionManager } from 'react-native';
import { useLibraryWaveformPreload } from '../useLibraryWaveformPreload';
import { extractNativeWaveform } from '../../utils/waveformExtraction';
import { setCachedWaveform } from '../../utils/waveformCache';
import { getCachedWaveformForSong } from '../../utils/waveformSourceCache';
import { buildNativeWaveform } from '../../utils/waveformGenerator';
import type { Song } from '../../types/Song';

jest.mock('../../utils/waveformExtraction', () => ({
  ...jest.requireActual('../../utils/waveformExtraction'), extractNativeWaveform: jest.fn(),
}));
jest.mock('../../utils/waveformCache', () => ({
  MAX_PERSISTED_WAVEFORMS: 256, setCachedWaveform: jest.fn(),
}));
jest.mock('../../utils/waveformSourceCache', () => ({ getCachedWaveformForSong: jest.fn() }));
const songs: Song[] = ['a', 'b'].map(id => ({ id, title: id, artist: 'CI', uri: `file:///${id}.mp3`, duration: 60000 }));
const flush = async () => { await act(async () => { await jest.advanceTimersByTimeAsync(1500); }); };
beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation(callback => {
    if (typeof callback === 'function') callback();
    return { cancel: jest.fn(), then: jest.fn(), done: jest.fn() } as never;
  });
  (getCachedWaveformForSong as jest.Mock).mockResolvedValue(null);
  (setCachedWaveform as jest.Mock).mockResolvedValue(undefined);
  (extractNativeWaveform as jest.Mock).mockImplementation(async (song: Song) =>
    buildNativeWaveform(song, { points: Array(16).fill(0.5), analysis: 'decoded-pcm-v1' }, 60000));
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('prepares imported songs once at background priority and reuses a disk hit', async () => {
  (getCachedWaveformForSong as jest.Mock).mockResolvedValueOnce({ source: 'native' });
  const hook = renderHook(() => useLibraryWaveformPreload(songs, true));
  expect(extractNativeWaveform).not.toHaveBeenCalled();
  await flush();
  expect(extractNativeWaveform).toHaveBeenCalledTimes(1);
  expect(extractNativeWaveform).toHaveBeenCalledWith(songs[1], 60000, expect.objectContaining({ priority: 'background' }));
  expect(setCachedWaveform).toHaveBeenCalledTimes(1);
  hook.unmount();
});

test('playback aborts the active analysis and prevents the next file from starting', async () => {
  let finish!: (value: null) => void;
  (extractNativeWaveform as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const hook = renderHook<void, { enabled: boolean }>(({ enabled }) => useLibraryWaveformPreload(songs, enabled), { initialProps: { enabled: true } });
  await flush();
  const signal = (extractNativeWaveform as jest.Mock).mock.calls[0][2].signal as AbortSignal;
  hook.rerender({ enabled: false });
  expect(signal.aborted).toBe(true);
  await act(async () => finish(null));
  expect(extractNativeWaveform).toHaveBeenCalledTimes(1);
  expect(setCachedWaveform).not.toHaveBeenCalled();
  hook.unmount();
});

test.each([500, 2000, 5000])('disabled preloading does not visit any of %i songs on mount or metadata edits', count => {
  let songReads = 0;
  const watched = (values: Song[]) => new Proxy(values, {
    get(target, property, receiver) {
      if (typeof property === 'string' && /^\d+$/.test(property)) songReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  const library = Array.from({ length: count }, (_, id) => ({ ...songs[0], id: String(id) }));
  const hook = renderHook<void, { current: Song[] }>(
    ({ current }) => useLibraryWaveformPreload(current, false),
    { initialProps: { current: watched(library) } },
  );
  hook.rerender({ current: watched(library.map(song => ({ ...song, title: 'Edited metadata' }))) });
  expect(songReads).toBe(0);
  expect(InteractionManager.runAfterInteractions).not.toHaveBeenCalled();
  expect(getCachedWaveformForSong).not.toHaveBeenCalled();
  expect(extractNativeWaveform).not.toHaveBeenCalled();
  hook.unmount();
});
