import { renderHook } from '@testing-library/react-native';
import { State, usePlaybackState, useProgress } from 'react-native-track-player';
import { useMiniPlayerProgressSnapshot } from '../useMiniPlayerProgress';

const mockProgress = { position: 25_000, duration: 100_000 };
jest.mock('../../contexts/PlaybackProgressContext', () => ({
  usePlaybackProgress: () => mockProgress,
}));

afterEach(() => { jest.restoreAllMocks(); });

test.each([State.Paused, State.Buffering, State.Loading, State.Stopped, State.Ended])(
  'retains the shared sample but stops native interpolation for %s', state => {
    jest.mocked(usePlaybackState).mockReturnValue({ state });
    const { result } = renderHook(() => useMiniPlayerProgressSnapshot());
    expect(result.current).toEqual({ progress: 0.25, duration: 100_000, isAdvancing: false });
  },
);

test('predicts only confirmed playing state and does not add a progress poll', () => {
  jest.mocked(usePlaybackState).mockReturnValue({ state: State.Playing });
  jest.mocked(useProgress).mockClear();
  const { result } = renderHook(() => useMiniPlayerProgressSnapshot());
  expect(result.current.isAdvancing).toBe(true);
  expect(useProgress).not.toHaveBeenCalled();
});
