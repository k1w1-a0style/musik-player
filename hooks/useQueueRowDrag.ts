import React from 'react';
import { Animated, Vibration } from 'react-native';
import { State, type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { resolveQueueReorderTargetIndex } from '../utils/soundCloudPlayer';

interface QueueRowDragOptions {
  index: number;
  queueLength: number;
  rowHeight: number;
  minShiftIndex: number;
  canDrag: boolean;
  getScrollOffset: () => number;
  onDragPosition?: (index: number, dragY: number, direction: -1 | 0 | 1) => void;
  onDragEnd?: () => void;
  onShift?: (fromIndex: number, toIndex: number) => void;
}

const createNativeDragEvent = (dragY: Animated.Value, move: (dy: number) => void) => Animated.event<
  PanGestureHandlerGestureEvent['nativeEvent']
>([{ nativeEvent: { translationY: dragY } }], {
  useNativeDriver: true,
  listener: (event: PanGestureHandlerGestureEvent) => move(event.nativeEvent.translationY ?? 0),
});

export const useAnimatedQueuePreview = (previewOffsetY: number): Animated.Value => {
  const previewY = React.useRef(new Animated.Value(previewOffsetY)).current;
  const previousRef = React.useRef(previewOffsetY);
  React.useEffect(() => {
    if (previousRef.current === previewOffsetY) return;
    previousRef.current = previewOffsetY;
    Animated.timing(previewY, { toValue: previewOffsetY, duration: 90, useNativeDriver: true }).start();
  }, [previewOffsetY, previewY]);
  return previewY;
};

export const useQueueRowDrag = ({ index, queueLength, rowHeight, minShiftIndex, canDrag,
  getScrollOffset, onDragPosition, onDragEnd, onShift }: QueueRowDragOptions) => {
  const [dragging, setDragging] = React.useState(false);
  const dragY = React.useRef(new Animated.Value(0)).current;
  const startScrollRef = React.useRef(0);
  const previousYRef = React.useRef(0);
  const previousTargetRef = React.useRef(index);
  const resolveTarget = React.useCallback((dy: number) => resolveQueueReorderTargetIndex({
    index, dy, rowHeight, startScrollOffset: startScrollRef.current,
    currentScrollOffset: getScrollOffset(), minIndex: minShiftIndex,
    maxIndex: Math.max(minShiftIndex, queueLength - 1),
  }), [getScrollOffset, index, minShiftIndex, queueLength, rowHeight]);
  const reset = React.useCallback(() => {
    previousYRef.current = 0;
    previousTargetRef.current = index;
    onDragEnd?.();
    setDragging(false);
    dragY.setValue(0);
  }, [dragY, index, onDragEnd]);
  const grant = React.useCallback(() => {
    if (!canDrag) return;
    startScrollRef.current = getScrollOffset();
    previousYRef.current = 0;
    previousTargetRef.current = index;
    Vibration.vibrate(10);
    setDragging(true);
    dragY.setValue(0);
    onDragPosition?.(index, 0, 0);
  }, [canDrag, dragY, getScrollOffset, index, onDragPosition]);
  const move = React.useCallback((dy: number) => {
    if (!canDrag) return;
    const delta = dy - previousYRef.current;
    previousYRef.current = dy;
    const target = resolveTarget(dy);
    if (target !== previousTargetRef.current) Vibration.vibrate(6);
    previousTargetRef.current = target;
    onDragPosition?.(index, dy, delta === 0 ? 0 : delta < 0 ? -1 : 1);
  }, [canDrag, index, onDragPosition, resolveTarget]);
  const release = React.useCallback((dy: number) => {
    const target = resolveTarget(dy);
    const shouldShift = canDrag && target !== index;
    // Commit the data mutation in the same release event. Waiting for an
    // animation callback made a native-list responder cancellation silently
    // drop the reorder. The preview offsets and the reordered data now settle
    // in one React batch, so rows remain visually continuous without a second
    // deferred mutation.
    if (shouldShift) onShift?.(index, target);
    reset();
  }, [canDrag, index, onShift, reset, resolveTarget]);
  const rowGestureEvent = React.useMemo(() => createNativeDragEvent(dragY, move), [dragY, move]);
  const handleGestureEvent = React.useMemo(() => createNativeDragEvent(dragY, move), [dragY, move]);
  const onGestureStateChange = React.useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { oldState, state, translationY = 0 } = event.nativeEvent;
    if (state === State.ACTIVE && oldState === State.BEGAN) grant();
    else if (state === State.END && oldState === State.ACTIVE) release(translationY);
    else if (state === State.CANCELLED || state === State.FAILED) reset();
  }, [grant, release, reset]);
  const longPressGestureHandlers = React.useMemo(() => ({
    onGestureEvent: rowGestureEvent,
    onHandlerStateChange: onGestureStateChange,
  }), [onGestureStateChange, rowGestureEvent]);
  const handleGestureHandlers = React.useMemo(() => ({
    onGestureEvent: handleGestureEvent,
    onHandlerStateChange: onGestureStateChange,
  }), [handleGestureEvent, onGestureStateChange]);
  return {
    dragEnabled: dragging,
    dragging,
    dragY,
    longPressGestureHandlers,
    handleGestureHandlers,
    reset,
  };
};
