import { act, renderHook } from '@testing-library/react-native';
import { State, type PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import { useQueueRowDrag } from '../useQueueRowDrag';

const emitNativeGesture = (event: unknown, translationY: number) => (
  event as { __getHandler: () => (value: PanGestureHandlerGestureEvent) => void }
).__getHandler()({ nativeEvent: { translationY } } as PanGestureHandlerGestureEvent);

describe('useQueueRowDrag responder contract', () => {
  test('commits a grip drag through one native gesture-handler contract', () => {
    const onShift = jest.fn();
    const onDragEnd = jest.fn();
    const { result } = renderHook(() => useQueueRowDrag({
      index: 1,
      queueLength: 4,
      rowHeight: 68,
      minShiftIndex: 0,
      canDrag: true,
      getScrollOffset: () => 0,
      onShift,
      onDragEnd,
    }));

    const handlers = result.current.handleGestureHandlers;
    act(() => handlers.onHandlerStateChange({
      nativeEvent: { oldState: State.BEGAN, state: State.ACTIVE, translationY: 0 },
    } as never));
    act(() => emitNativeGesture(handlers.onGestureEvent, 80));
    act(() => handlers.onHandlerStateChange({
      nativeEvent: { oldState: State.ACTIVE, state: State.END, translationY: 80 },
    } as never));

    expect(onShift).toHaveBeenCalledTimes(1);
    expect(onShift).toHaveBeenCalledWith(1, 2);
    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(result.current.dragEnabled).toBe(false);
  });

  test('commits the same reorder through the delayed row pan gesture', () => {
    const onShift = jest.fn();
    const { result } = renderHook(() => useQueueRowDrag({
      index: 1, queueLength: 4, rowHeight: 68, minShiftIndex: 0, canDrag: true,
      getScrollOffset: () => 0, onShift,
    }));

    act(() => result.current.longPressGestureHandlers.onHandlerStateChange({
      nativeEvent: { oldState: 2, state: 4, translationY: 0 },
    } as never));
    act(() => emitNativeGesture(result.current.longPressGestureHandlers.onGestureEvent, 80));
    act(() => result.current.longPressGestureHandlers.onHandlerStateChange({
      nativeEvent: { oldState: 4, state: 5, translationY: 80 },
    } as never));

    expect(onShift).toHaveBeenCalledWith(1, 2);
    expect(result.current.dragging).toBe(false);
  });
});
