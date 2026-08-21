import { act, renderHook } from '@testing-library/react-native';
import type { Song } from '../../types/Song';
import { preloadSongWaveform } from '../../utils/waveformPreload';
import { useAdjacentWaveformPreload, useWaveformPreload } from '../useWaveformPreload';

jest.mock('../../utils/waveformPreload', () => ({
  preloadSongWaveform: jest.fn(),
}));

const mockedPreload = preloadSongWaveform as jest.MockedFunction<typeof preloadSongWaveform>;
const song = (id: string): Song => ({
  id, title: id, artist: 'Artist', uri: `file:///${id}.mp3`,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
};

describe('useAdjacentWaveformPreload', () => {
  beforeEach(() => {
    mockedPreload.mockReset();
  });

  test('warms next first and previous only after next settles', async () => {
    const next = song('next');
    const previous = song('previous');
    const nextPreload = deferred<null>();
    mockedPreload.mockImplementation(target =>
      target?.id === next.id ? nextPreload.promise : Promise.resolve(null));

    renderHook(() => useAdjacentWaveformPreload(next, previous));
    expect(mockedPreload).toHaveBeenCalledTimes(1);
    expect(mockedPreload).toHaveBeenNthCalledWith(1, next, { priority: 'preload' });

    await act(async () => {
      nextPreload.resolve(null);
      await nextPreload.promise;
    });

    expect(mockedPreload).toHaveBeenCalledTimes(2);
    expect(mockedPreload).toHaveBeenNthCalledWith(2, previous, { priority: 'background' });
  });

  test('single-song preload restarts only when the audio identity changes', () => {
    mockedPreload.mockResolvedValue(null);
    const first = song('first');
    const hook = renderHook<void, { target: Song }>(
      ({ target }) => useWaveformPreload(target),
      { initialProps: { target: first } },
    );
    expect(mockedPreload).toHaveBeenCalledTimes(1);

    hook.rerender({ target: { ...first, title: 'Edited title only' } });
    expect(mockedPreload).toHaveBeenCalledTimes(1);

    const second = song('second');
    hook.rerender({ target: second });
    expect(mockedPreload).toHaveBeenCalledTimes(2);
    expect(mockedPreload).toHaveBeenLastCalledWith(second);
  });
});
