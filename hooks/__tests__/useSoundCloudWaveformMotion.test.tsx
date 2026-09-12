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
  test('reports a live drag preview and commits the same final seek once', async () => {
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
    const event = result.current.onGestureEvent as unknown as {
      __isNative: boolean;
      __getHandler: () => (event: PanGestureHandlerGestureEvent) => void;
    };
    expect(event.__isNative).toBe(true);
    act(() => event.__getHandler()(gestureEvent(-250)));

    expect(onPreviewPosition).toHaveBeenLastCalledWith(75_000);

    act(() => result.current.onStateChange(stateEvent({
      state: State.END, oldState: State.ACTIVE, translationX: -250,
    })));

    await act(async () => { await Promise.resolve(); });
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(75_000);
    expect(onPreviewPosition).toHaveBeenLastCalledWith(75_000);
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

test('stale progress cannot snap a released seek backwards before native confirmation', async () => {
  const onPreviewPosition = jest.fn();
  const onSeek = jest.fn();
  const hook = renderHook<ReturnType<typeof useSoundCloudWaveformMotion>, { position: number }>(
    ({ position }) => useSoundCloudWaveformMotion({ progressRatio: position / 100000,
      safeDuration: 100000, safePosition: position, isPlaying: false, travelWidth: 1000,
      viewportCenter: 200, waveformKey: 'track', onSeek, onPreviewPosition }),
    { initialProps: { position: 50000 } },
  );
  act(() => hook.result.current.onStateChange(stateEvent({ state: State.BEGAN, oldState: State.UNDETERMINED })));
  await act(async () => hook.result.current.onStateChange(stateEvent({
    state: State.END, oldState: State.ACTIVE, translationX: -250,
  })));
  const offset = () => (hook.result.current.translateX as unknown as { __getValue: () => number }).__getValue();
  expect(offset()).toBe(-550);
  hook.rerender({ position: 50500 });
  expect(offset()).toBe(-550);
  expect(onPreviewPosition).toHaveBeenLastCalledWith(75000);
  hook.rerender({ position: 75500 });
  expect(offset()).toBe(-555);
  expect(onPreviewPosition).toHaveBeenLastCalledWith(null);
  hook.unmount();
});
