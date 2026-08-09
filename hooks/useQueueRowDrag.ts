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
  dragEnabled: boolean;
  onGrant: () => void;
  onMove: (gesture: PanResponderGestureState) => void;
  onRelease: (gesture: PanResponderGestureState) => void;
  onCancel: () => void;
}

const useQueuePanResponder = ({ canDrag, dragEnabled, onGrant, onMove, onRelease, onCancel }: QueuePanResponderOptions) => React.useMemo(() => PanResponder.create({
  onStartShouldSetPanResponder: () => false,
  onMoveShouldSetPanResponder: (_event, gesture) => canDrag && dragEnabled && Math.abs(gesture.dy) > 4,
  onPanResponderGrant: onGrant,
  onPanResponderMove: (_event, gesture) => onMove(gesture),
  onPanResponderRelease: (_event, gesture) => onRelease(gesture),
  onPanResponderTerminate: onCancel,
  onShouldBlockNativeResponder: () => false,
}), [canDrag, dragEnabled, onCancel, onGrant, onMove, onRelease]);

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
  const [dragEnabled, setDragEnabled] = React.useState(false);
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
    setDragEnabled(false);
  }, [dragY, index, onDragEnd]);
  const grant = React.useCallback(() => {
    if (!canDrag) return;
    startScrollRef.current = getScrollOffset();
    previousYRef.current = 0;
    previousTargetRef.current = index;
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
    Animated.spring(dragY, { toValue: shouldShift ? (target - index) * rowHeight : 0,
      tension: 180, friction: 24, useNativeDriver: true }).start(() => {
      if (shouldShift) onShift?.(index, target);
      reset();
    });
  }, [canDrag, dragY, index, onShift, reset, resolveTarget, rowHeight]);
  const panResponder = useQueuePanResponder({ canDrag, dragEnabled, onGrant: grant, onMove: move, onRelease: release, onCancel: reset });
  const enableDrag = React.useCallback(() => {
    if (!canDrag) return;
    Vibration.vibrate(10);
    setDragEnabled(true);
  }, [canDrag]);
  return { dragEnabled, dragging, dragY, panHandlers: panResponder.panHandlers, reset, enableDrag };
};
