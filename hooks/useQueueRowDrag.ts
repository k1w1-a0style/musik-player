import React from 'react';
import { Animated, PanResponder, Vibration, type PanResponderGestureState } from 'react-native';
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

interface QueuePanResponderOptions {
  canDrag: boolean;
  onGrant: () => void;
  onMove: (gesture: PanResponderGestureState) => void;
  onRelease: (gesture: PanResponderGestureState) => void;
  onCancel: () => void;
}

const useQueuePanResponder = (options: QueuePanResponderOptions) => {
  const optionsRef = React.useRef(options);
  optionsRef.current = options;
  return React.useMemo(() => PanResponder.create({
    // These handlers are installed only on the visible grip. Claiming its
    // touch at START avoids trying to steal an already-active Android list
    // gesture after a delayed long-press.
    onStartShouldSetPanResponder: () => optionsRef.current.canDrag,
    onStartShouldSetPanResponderCapture: () => optionsRef.current.canDrag,
    onMoveShouldSetPanResponder: () => optionsRef.current.canDrag,
    onMoveShouldSetPanResponderCapture: () => optionsRef.current.canDrag,
    onPanResponderGrant: () => optionsRef.current.onGrant(),
    onPanResponderMove: (_event, gesture) => optionsRef.current.onMove(gesture),
    onPanResponderRelease: (_event, gesture) => optionsRef.current.onRelease(gesture),
    onPanResponderTerminate: () => optionsRef.current.onCancel(),
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }), []);
};

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
  const move = React.useCallback((gesture: PanResponderGestureState) => {
    if (!canDrag) return;
    const delta = gesture.dy - previousYRef.current;
    previousYRef.current = gesture.dy;
    dragY.setValue(gesture.dy);
    const target = resolveTarget(gesture.dy);
    if (target !== previousTargetRef.current) Vibration.vibrate(6);
    previousTargetRef.current = target;
    onDragPosition?.(index, gesture.dy, delta === 0 ? 0 : delta < 0 ? -1 : 1);
  }, [canDrag, dragY, index, onDragPosition, resolveTarget]);
  const release = React.useCallback((gesture: PanResponderGestureState) => {
    const target = resolveTarget(gesture.dy);
    const shouldShift = canDrag && target !== index;
    // Commit the data mutation in the same release event. Waiting for an
    // animation callback made a native-list responder cancellation silently
    // drop the reorder. The preview offsets and the reordered data now settle
    // in one React batch, so rows remain visually continuous without a second
    // deferred mutation.
    if (shouldShift) onShift?.(index, target);
    reset();
  }, [canDrag, index, onShift, reset, resolveTarget]);
  const panResponder = useQueuePanResponder({ canDrag, onGrant: grant, onMove: move,
    onRelease: release, onCancel: reset });
  return { dragEnabled: dragging, dragging, dragY, panHandlers: panResponder.panHandlers, reset };
};
