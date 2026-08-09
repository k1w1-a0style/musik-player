import React from 'react';
import type { FlatList } from 'react-native';
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
  listRef: React.RefObject<FlatList<Song> | null>;
  dragPositionRef: React.RefObject<QueueDragPosition | null>;
  scrollOffsetRef: React.RefObject<number>;
  viewportHeightRef: React.RefObject<number>;
  updatePreview: (drag: QueueDragPosition) => void;
}

const useQueueAutoScroller = ({ queueLength, listRef, dragPositionRef, scrollOffsetRef, viewportHeightRef, updatePreview }: QueueAutoScrollerArgs) => {
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
      const eligible = drag && resolveQueueAutoScrollDirection({ ...drag, scrollOffset: drag.startScrollOffset, viewportHeight: viewportHeightRef.current });
      if (!drag || eligible !== direction) return stop();
      const maxOffset = Math.max(0, queueLength * SOUNDCLOUD_QUEUE_ROW_HEIGHT + 16 - viewportHeightRef.current);
      const nextOffset = Math.max(0, Math.min(maxOffset, scrollOffsetRef.current + direction * 12));
      if (nextOffset === scrollOffsetRef.current) return stop();
      scrollOffsetRef.current = nextOffset;
      listRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
      updatePreview(drag);
    }, 32);
  }, [dragPositionRef, listRef, queueLength, scrollOffsetRef, stop, updatePreview, viewportHeightRef]);
  React.useEffect(() => stop, [stop]);
  return { start, stop };
};

export const useNowPlayingQueueDrag = ({ queueLength, currentIndex, listRef, scrollOffsetRef, viewportHeightRef }: Omit<QueueAutoScrollerArgs, 'dragPositionRef' | 'updatePreview'> & { currentIndex: number }) => {
  const dragPositionRef = React.useRef<QueueDragPosition | null>(null);
  const [dragPreview, setDragPreview] = React.useState<QueueDragPreview | null>(null);
  const minShiftIndex = Math.max(1, currentIndex + 1);
  const updatePreview = React.useCallback((drag: QueueDragPosition) => {
    const targetIndex = resolveQueueReorderTargetIndex({ index: drag.index, dy: drag.dragY,
      rowHeight: SOUNDCLOUD_QUEUE_ROW_HEIGHT, startScrollOffset: drag.startScrollOffset,
      currentScrollOffset: scrollOffsetRef.current, minIndex: minShiftIndex,
      maxIndex: Math.max(minShiftIndex, queueLength - 1) });
    setDragPreview(current => current?.index === drag.index && current.targetIndex === targetIndex
      ? current : { index: drag.index, targetIndex });
  }, [minShiftIndex, queueLength, scrollOffsetRef]);
  const { start: startAutoScroll, stop: stopAutoScroll } = useQueueAutoScroller({
    queueLength, listRef, dragPositionRef, scrollOffsetRef, viewportHeightRef, updatePreview,
  });
  const handleDragPosition = React.useCallback((index: number, dragY: number, movementDirection: -1 | 0 | 1) => {
    const previous = dragPositionRef.current;
    const drag = { index, dragY, movementDirection,
      startScrollOffset: previous?.index === index ? previous.startScrollOffset : scrollOffsetRef.current };
    dragPositionRef.current = drag;
    updatePreview(drag);
    const direction = resolveQueueAutoScrollDirection({ ...drag, scrollOffset: drag.startScrollOffset, viewportHeight: viewportHeightRef.current });
    if (direction === 0) stopAutoScroll();
    else startAutoScroll(direction);
  }, [scrollOffsetRef, startAutoScroll, stopAutoScroll, updatePreview, viewportHeightRef]);
  const handleDragEnd = React.useCallback(() => {
    dragPositionRef.current = null;
    setDragPreview(null);
    stopAutoScroll();
  }, [stopAutoScroll]);
  return { dragPreview, minShiftIndex, handleDragPosition, handleDragEnd };
};
