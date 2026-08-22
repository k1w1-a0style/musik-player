import { act, renderHook } from '@testing-library/react-native';
import { State, type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { useSoundCloudWaveformMotion } from '../useSoundCloudWaveformMotion';

const stateEvent = (nativeEvent: Record<string, number>) => (
  { nativeEvent } as unknown as PanGestureHandlerStateChangeEvent
);
const gestureEvent = (translationX: number) => (
  { nativeEvent: { translationX } } as unknown as PanGestureHandlerGestureEvent
);

describe('useSoundCloudWaveformMotion', () => {
  test('reports a live drag preview and commits the same final seek once', () => {
    const onSeek = jest.fn();
    const onPreviewPosition = jest.fn();
    const { result } = renderHook(() => useSoundCloudWaveformMotion({
      progressRatio: 0.5,
      safeDuration: 100_000,
      safePosition: 50_000,
      isPlaying: false,
      travelWidth: 1_000,
      viewportCenter: 200,
      waveformKey: 'track-1',
      onSeek,
      onPreviewPosition,
    }));

    act(() => result.current.onStateChange(stateEvent({
      state: State.BEGAN, oldState: State.UNDETERMINED, translationX: 0,
    })));
    expect(typeof result.current.onGestureEvent).toBe('function');
    act(() => result.current.onGestureEvent(gestureEvent(-250)));

    expect(onPreviewPosition).toHaveBeenLastCalledWith(75_000);

    act(() => result.current.onStateChange(stateEvent({
      state: State.END, oldState: State.ACTIVE, translationX: -250,
    })));

    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(75_000);
    expect(onPreviewPosition).toHaveBeenLastCalledWith(null);
  });

  test.each([State.CANCELLED, State.FAILED])(
    'does not commit a seek when an active drag ends as %s',
    cancelledState => {
      const onSeek = jest.fn();
      const onPreviewPosition = jest.fn();
      const { result } = renderHook(() => useSoundCloudWaveformMotion({
        progressRatio: 0.5,
        safeDuration: 100_000,
        safePosition: 50_000,
        isPlaying: false,
        travelWidth: 1_000,
        viewportCenter: 200,
        waveformKey: 'track-1',
        onSeek,
        onPreviewPosition,
      }));

      act(() => result.current.onStateChange(stateEvent({
        state: State.BEGAN, oldState: State.UNDETERMINED, translationX: 0,
      })));
      act(() => result.current.onStateChange(stateEvent({
        state: cancelledState, oldState: State.ACTIVE, translationX: -250,
      })));

      expect(onSeek).not.toHaveBeenCalled();
      expect(onPreviewPosition).toHaveBeenLastCalledWith(null);
    },
  );
});
