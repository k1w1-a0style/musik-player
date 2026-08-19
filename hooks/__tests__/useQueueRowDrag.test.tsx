import { act, renderHook } from '@testing-library/react-native';
import { useQueueRowDrag } from '../useQueueRowDrag';

const responderEvent = (currentY: number, previousY: number, timestamp: number) => ({
  nativeEvent: { touches: [{}] },
  touchHistory: {
    numberActiveTouches: 1,
    indexOfSingleActiveTouch: 0,
    mostRecentTimeStamp: timestamp,
    touchBank: [{
      touchActive: true,
      startPageX: 0,
      startPageY: 0,
      currentPageX: 0,
      currentPageY: currentY,
      previousPageX: 0,
      previousPageY: previousY,
      startTimeStamp: 1,
      currentTimeStamp: timestamp,
      previousTimeStamp: Math.max(1, timestamp - 1),
    }],
  },
});

describe('useQueueRowDrag responder contract', () => {
  test('claims a grip touch immediately and commits the reorder synchronously', () => {
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

    const handlers = result.current.panHandlers as Record<string, (...args: unknown[]) => unknown>;
    const start = responderEvent(0, 0, 1);
    const move = responderEvent(80, 10, 3);

    expect(handlers.onStartShouldSetResponderCapture?.(start)).toBe(true);
    expect(handlers.onResponderTerminationRequest?.()).toBe(false);
    act(() => handlers.onResponderGrant?.(start));
    act(() => handlers.onResponderMove?.(move));
    act(() => handlers.onResponderRelease?.(move));

    expect(onShift).toHaveBeenCalledTimes(1);
    expect(onShift).toHaveBeenCalledWith(1, 2);
    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(result.current.dragEnabled).toBe(false);
  });
});
