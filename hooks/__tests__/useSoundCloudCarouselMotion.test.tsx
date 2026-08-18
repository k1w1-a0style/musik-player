import { act, renderHook } from '@testing-library/react-native';
import { State, type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { useHorizontalTrackMotion, useVerticalPlayerMotion } from '../useSoundCloudCarouselMotion';

const gestureEvent = (nativeEvent: { translationX?: number; translationY?: number }) => (
  { nativeEvent } as unknown as PanGestureHandlerGestureEvent
);
const stateEvent = (nativeEvent: Record<string, number>) => (
  { nativeEvent } as unknown as PanGestureHandlerStateChangeEvent
);

describe('SoundCloud carousel gesture listeners', () => {
  test('exposes a function listener and applies horizontal drag updates', () => {
    const { result, unmount } = renderHook(() => useHorizontalTrackMotion({
      currentSongId: 'track-1',
      panelWidth: 360,
      onNext: jest.fn(),
      onPrevious: jest.fn(),
      hasPrevious: true,
      hasNext: true,
      reduceMotion: false,
    }));

    expect(typeof result.current.onGestureEvent).toBe('function');
    act(() => result.current.onGestureEvent(gestureEvent({ translationX: -48 })));
    const dragValue = result.current.drag as unknown as { __getValue: () => number };
    expect(dragValue.__getValue()).toBe(-48);
    unmount();
  });

  test('exposes a function listener for the nested vertical gesture', () => {
    const { result, unmount } = renderHook(() => useVerticalPlayerMotion({
      height: 800,
      onCollapse: jest.fn(),
      onOpenQueue: jest.fn(),
      reduceMotion: false,
    }));

    expect(typeof result.current.onGestureEvent).toBe('function');
    expect(() => act(() => result.current.onGestureEvent(gestureEvent({ translationY: 64 })))).not.toThrow();
    unmount();
  });

  test('opens the queue for an upward fling without collapsing the player', () => {
    const onCollapse = jest.fn();
    const onOpenQueue = jest.fn();
    const { result, unmount } = renderHook(() => useVerticalPlayerMotion({
      height: 800,
      onCollapse,
      onOpenQueue,
      reduceMotion: true,
    }));

    act(() => result.current.onStateChange(stateEvent({
      oldState: State.ACTIVE,
      state: State.END,
      translationX: 2,
      translationY: -70,
      velocityY: -1_000,
    })));

    expect(onOpenQueue).toHaveBeenCalledTimes(1);
    expect(onCollapse).not.toHaveBeenCalled();
    unmount();
  });
});
