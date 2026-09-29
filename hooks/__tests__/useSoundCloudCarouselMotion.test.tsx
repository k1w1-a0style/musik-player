import { act, renderHook } from '@testing-library/react-native';
import { Animated } from 'react-native';
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
  test.each([State.CANCELLED, State.FAILED])(
    'a second gesture ending as %s cannot reverse an ongoing track switch', state => {
      let finishAnimation!: (result: { finished: boolean }) => void;
      jest.spyOn(Animated, 'timing').mockImplementation(() => ({
        start: callback => { finishAnimation = callback!; }, stop: jest.fn(), reset: jest.fn(),
      }));
      const spring = jest.spyOn(Animated, 'spring');
      const onNext = jest.fn(() => new Promise<void>(() => undefined));
      const { result, unmount } = renderHook(() => useHorizontalTrackMotion({
        currentSongId: 'track-1', panelWidth: 360, onNext, onPrevious: jest.fn(),
        hasPrevious: true, hasNext: true, reduceMotion: false, dispatchBeforeAnimation: true,
      }));
      try {
        act(() => result.current.onStateChange(stateEvent({
          oldState: State.ACTIVE, state: State.END, translationX: -140, translationY: 0,
        })));
        act(() => result.current.onStateChange(stateEvent({
          oldState: State.ACTIVE, state, translationX: 12, translationY: 0,
        })));
        expect(spring).not.toHaveBeenCalled();
        act(() => finishAnimation({ finished: true }));
        expect(onNext).toHaveBeenCalledTimes(1);
        expect(spring).not.toHaveBeenCalled();
      } finally {
        unmount();
        jest.restoreAllMocks();
      }
    },
  );

  test('a timed-out action settling late cannot roll back a newer track transition', async () => {
    jest.useFakeTimers();
    let settleFirst!: () => void;
    const onNext = jest.fn()
      .mockImplementationOnce(() => new Promise<void>(resolve => { settleFirst = resolve; }))
      .mockImplementationOnce(() => new Promise<void>(() => undefined));
    jest.spyOn(Animated, 'timing').mockImplementation(() => ({
      start: callback => callback?.({ finished: true }), stop: jest.fn(), reset: jest.fn(),
    }));
    const spring = jest.spyOn(Animated, 'spring').mockImplementation(() => ({
      start: callback => callback?.({ finished: true }), stop: jest.fn(), reset: jest.fn(),
    }));
    const { result, unmount } = renderHook(() => useHorizontalTrackMotion({
      currentSongId: 'track-1', panelWidth: 360, onNext, onPrevious: jest.fn(),
      hasPrevious: true, hasNext: true, reduceMotion: false, dispatchBeforeAnimation: true,
    }));
    const swipe = () => result.current.onStateChange(stateEvent({
      oldState: State.ACTIVE, state: State.END, translationX: -140, translationY: 0,
    }));
    try {
      act(swipe);
      act(() => jest.advanceTimersByTime(8_000));
      expect(spring).toHaveBeenCalledTimes(1);
      act(swipe);
      expect(onNext).toHaveBeenCalledTimes(2);
      await act(async () => { settleFirst(); });
      act(() => jest.advanceTimersByTime(1_600));
      expect(spring).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
      jest.restoreAllMocks();
      jest.useRealTimers();
    }
  });

  test('stopping an animation during unmount does not start a return animation', () => {
    let finish!: (result: { finished: boolean }) => void;
    jest.spyOn(Animated, 'timing').mockImplementation(() => ({
      start: callback => { finish = callback!; }, stop: jest.fn(), reset: jest.fn(),
    }));
    const spring = jest.spyOn(Animated, 'spring');
    const { result, unmount } = renderHook(() => useHorizontalTrackMotion({
      currentSongId: 'track-1', panelWidth: 360, onNext: jest.fn(), onPrevious: jest.fn(),
      hasPrevious: true, hasNext: true, reduceMotion: false, dispatchBeforeAnimation: true,
    }));
    try {
      act(() => result.current.onStateChange(stateEvent({
        oldState: State.ACTIVE, state: State.END, translationX: -140, translationY: 0,
      })));
      unmount();
      act(() => finish({ finished: false }));
      expect(spring).not.toHaveBeenCalled();
    } finally { jest.restoreAllMocks(); }
  });

  test.each([State.CANCELLED, State.FAILED])(
    'a passive vertical recognizer ending as %s preserves the opened queue position', state => {
      const drag = new Animated.Value(0);
      const changed = jest.fn();
      const { result, unmount } = renderHook(() => useVerticalPlayerMotion({
        drag, height: 800, onCollapse: jest.fn(), onOpenQueue: jest.fn(), reduceMotion: true,
      }));
      act(() => drag.setValue(-800));
      drag.addListener(changed);
      act(() => result.current.onStateChange(stateEvent({ oldState: State.BEGAN, state })));
      expect(changed).not.toHaveBeenCalled();
      unmount();
    },
  );

  test('binds horizontal drag updates to a native animated event', () => {
    const { result, unmount } = renderHook(() => useHorizontalTrackMotion({
      currentSongId: 'track-1',
      panelWidth: 360,
      onNext: jest.fn(),
      onPrevious: jest.fn(),
      hasPrevious: true,
      hasNext: true,
      reduceMotion: false,
    }));

    const event = result.current.onGestureEvent as unknown as { __isNative: boolean };
    expect(event.__isNative).toBe(true);
    unmount();
  });

  test('uses a native animated event plus a lightweight vertical preview listener', () => {
    const { result, unmount } = renderHook(() => useVerticalPlayerMotion({
      drag: new Animated.Value(0),
      height: 800,
      onCollapse: jest.fn(),
      onOpenQueue: jest.fn(),
      reduceMotion: false,
    }));

    const event = result.current.onGestureEvent as unknown as {
      __isNative: boolean;
      __getHandler: () => (event: PanGestureHandlerGestureEvent) => void;
    };
    expect(event.__isNative).toBe(true);
    expect(() => act(() => event.__getHandler()(gestureEvent({ translationY: 64 })))).not.toThrow();
    unmount();
  });

  test('opens the queue for an upward fling without collapsing the player', () => {
    const onCollapse = jest.fn();
    const onOpenQueue = jest.fn();
    const { result, unmount } = renderHook(() => useVerticalPlayerMotion({
      drag: new Animated.Value(0),
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

  test.each([State.CANCELLED, State.FAILED])(
    'does not switch tracks when a horizontal swipe ends as %s',
    cancelledState => {
      const onNext = jest.fn();
      const onPrevious = jest.fn();
      const { result, unmount } = renderHook(() => useHorizontalTrackMotion({
        currentSongId: 'track-1',
        panelWidth: 360,
        onNext,
        onPrevious,
        hasPrevious: true,
        hasNext: true,
        reduceMotion: true,
      }));

      act(() => result.current.onStateChange(stateEvent({
        oldState: State.ACTIVE,
        state: cancelledState,
        translationX: -300,
        translationY: 0,
        velocityX: -1_000,
      })));

      expect(onNext).not.toHaveBeenCalled();
      expect(onPrevious).not.toHaveBeenCalled();
      unmount();
    },
  );

  test.each([State.CANCELLED, State.FAILED])(
    'does not open or collapse the player when a vertical swipe ends as %s',
    cancelledState => {
      const onCollapse = jest.fn();
      const onOpenQueue = jest.fn();
      const { result, unmount } = renderHook(() => useVerticalPlayerMotion({
        drag: new Animated.Value(0),
        height: 800,
        onCollapse,
        onOpenQueue,
        reduceMotion: true,
      }));

      act(() => result.current.onStateChange(stateEvent({
        oldState: State.ACTIVE,
        state: cancelledState,
        translationX: 0,
        translationY: 600,
        velocityY: 1_000,
      })));

      expect(onCollapse).not.toHaveBeenCalled();
      expect(onOpenQueue).not.toHaveBeenCalled();
      unmount();
    },
  );
});
