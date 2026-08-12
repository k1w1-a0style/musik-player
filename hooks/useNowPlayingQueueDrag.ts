import React from 'react';
import { Animated, type FlatList } from 'react-native';
import type { Song } from '../types/Song';
import {
  resolveQueueAutoScrollDirection,
  resolveQueueReorderTargetIndex,
  SOUNDCLOUD_QUEUE_ROW_HEIGHT,
} from '../utils/soundCloudPlayer';

export interface QueueDragPosition {
  index: number;
  dragY: number;
  movementDirection: -1 | 0 | 1;
  startScrollOffset: number;
}

export interface QueueDragPreview {
  index: number;
  targetIndex: number;
}

interface QueueAutoScrollerArgs {
  queueLength: number;
  rowHeight: number;
  listRef: React.RefObject<FlatList<Song> | null>;
  dragPositionRef: React.RefObject<QueueDragPosition | null>;
  scrollOffsetRef: React.RefObject<number>;
  viewportHeightRef: React.RefObject<number>;
  contentHeightOffsetRef: React.RefObject<number>;
  rowStartOffsetRef: React.RefObject<number>;
  dragScrollCompensation: Animated.Value;
  updatePreview: (drag: QueueDragPosition) => void;
}

const useQueueAutoScroller = ({ queueLength, rowHeight, listRef, dragPositionRef,
  scrollOffsetRef, viewportHeightRef, contentHeightOffsetRef, rowStartOffsetRef,
  dragScrollCompensation, updatePreview }: QueueAutoScrollerArgs) => {
  const directionRef = React.useRef<-1 | 0 | 1>(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = React.useCallback(() => {
    directionRef.current = 0;
    if (!timerRef.current) return;
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);
  const start = React.useCallback((direction: -1 | 1) => {
    if (directionRef.current === direction && timerRef.current) return;
    stop();
    directionRef.current = direction;
    timerRef.current = setInterval(() => {
      const drag = dragPositionRef.current;
      const eligible = drag && resolveQueueAutoScrollDirection({ ...drag,
        scrollOffset: scrollOffsetRef.current - rowStartOffsetRef.current,
        viewportHeight: viewportHeightRef.current, rowHeight });
      if (!drag || eligible !== direction) return stop();
      const maxOffset = Math.max(0, queueLength * rowHeight + contentHeightOffsetRef.current
        + 16 - viewportHeightRef.current);
      const nextOffset = Math.max(0, Math.min(maxOffset, scrollOffsetRef.current + direction * 12));
      if (nextOffset === scrollOffsetRef.current) return stop();
      scrollOffsetRef.current = nextOffset;
      dragScrollCompensation.setValue(nextOffset - drag.startScrollOffset);
      listRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
      updatePreview(drag);
    }, 32);
  }, [contentHeightOffsetRef, dragPositionRef, dragScrollCompensation, listRef, queueLength, rowHeight,
    rowStartOffsetRef, scrollOffsetRef, stop, updatePreview, viewportHeightRef]);
  React.useEffect(() => stop, [stop]);
  return { start, stop };
};

interface ReorderableListDragArgs extends Omit<QueueAutoScrollerArgs,
  'contentHeightOffsetRef' | 'dragPositionRef' | 'dragScrollCompensation' | 'rowHeight'
  | 'rowStartOffsetRef' | 'updatePreview'> {
  currentIndex: number;
  rowHeight?: number;
  minimumReorderIndex?: number;
  contentHeightOffsetRef?: React.RefObject<number>;
  rowStartOffsetRef?: React.RefObject<number>;
}

export const useReorderableSongListDrag = ({ queueLength, currentIndex, listRef, scrollOffsetRef,
  viewportHeightRef, rowHeight = SOUNDCLOUD_QUEUE_ROW_HEIGHT, minimumReorderIndex,
  contentHeightOffsetRef: providedContentHeightOffsetRef,
  rowStartOffsetRef: providedRowStartOffsetRef }: ReorderableListDragArgs) => {
  const dragPositionRef = React.useRef<QueueDragPosition | null>(null);
  const dragScrollCompensation = React.useRef(new Animated.Value(0)).current;
  const fallbackContentHeightOffsetRef = React.useRef(0);
  const fallbackRowStartOffsetRef = React.useRef(0);
  const contentHeightOffsetRef = providedContentHeightOffsetRef ?? fallbackContentHeightOffsetRef;
  const rowStartOffsetRef = providedRowStartOffsetRef ?? fallbackRowStartOffsetRef;
  const [dragPreview, setDragPreview] = React.useState<QueueDragPreview | null>(null);
  const minShiftIndex = minimumReorderIndex ?? Math.max(1, currentIndex + 1);
  const updatePreview = React.useCallback((drag: QueueDragPosition) => {
    const targetIndex = resolveQueueReorderTargetIndex({ index: drag.index, dy: drag.dragY,
      rowHeight, startScrollOffset: drag.startScrollOffset,
      currentScrollOffset: scrollOffsetRef.current, minIndex: minShiftIndex,
      maxIndex: Math.max(minShiftIndex, queueLength - 1) });
    setDragPreview(current => current?.index === drag.index && current.targetIndex === targetIndex
      ? current : { index: drag.index, targetIndex });
  }, [minShiftIndex, queueLength, rowHeight, scrollOffsetRef]);
  const { start: startAutoScroll, stop: stopAutoScroll } = useQueueAutoScroller({
    queueLength, rowHeight, listRef, dragPositionRef, scrollOffsetRef, viewportHeightRef,
    contentHeightOffsetRef, rowStartOffsetRef, dragScrollCompensation, updatePreview,
  });
  const handleDragPosition = React.useCallback((index: number, dragY: number, movementDirection: -1 | 0 | 1) => {
    const previous = dragPositionRef.current;
    if (previous?.index !== index) dragScrollCompensation.setValue(0);
    const drag = { index, dragY, movementDirection,
      startScrollOffset: previous?.index === index ? previous.startScrollOffset : scrollOffsetRef.current };
    dragPositionRef.current = drag;
    updatePreview(drag);
    const direction = resolveQueueAutoScrollDirection({ ...drag,
      scrollOffset: scrollOffsetRef.current - rowStartOffsetRef.current,
      viewportHeight: viewportHeightRef.current, rowHeight });
    if (direction === 0) stopAutoScroll();
    else startAutoScroll(direction);
  }, [dragScrollCompensation, rowHeight, rowStartOffsetRef, scrollOffsetRef,
    startAutoScroll, stopAutoScroll, updatePreview, viewportHeightRef]);
  const handleDragEnd = React.useCallback(() => {
    dragPositionRef.current = null;
    dragScrollCompensation.setValue(0);
    setDragPreview(null);
    stopAutoScroll();
  }, [dragScrollCompensation, stopAutoScroll]);
  return { dragPreview, dragScrollCompensation, minShiftIndex, handleDragPosition, handleDragEnd };
};

export const useNowPlayingQueueDrag = useReorderableSongListDrag;
