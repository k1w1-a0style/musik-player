import React from 'react';
import { FlatList, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { NativeViewGestureHandler } from 'react-native-gesture-handler';
import type { Song } from '../types/Song';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { buildSongKey, displayArtist, displayTitle } from '../utils/libraryPresentation';
import NowPlayingQueuePreviewRow from './NowPlayingQueuePreviewRow';
const QUEUE_ROW_HEIGHT = 44;
const QUEUE_EDGE_SCROLL_ZONE = QUEUE_ROW_HEIGHT * 1.25;
const QUEUE_AUTO_SCROLL_STEP = 12;
const QUEUE_AUTO_SCROLL_INTERVAL_MS = 32;
export const resolveQueueAutoScrollDirection = ({
  index,
  dragY,
  movementDirection,
  scrollOffset,
  viewportHeight,
}: {
  index: number;
  dragY: number;
  movementDirection: -1 | 0 | 1;
  scrollOffset: number;
  viewportHeight: number;
}): -1 | 0 | 1 => {
  if (viewportHeight <= 0) return 0;
  const visibleTop = index * QUEUE_ROW_HEIGHT - scrollOffset + dragY;
  const visibleBottom = visibleTop + QUEUE_ROW_HEIGHT;
  if (movementDirection < 0 && visibleTop < QUEUE_EDGE_SCROLL_ZONE) return -1;
  if (movementDirection > 0 && visibleBottom > viewportHeight - QUEUE_EDGE_SCROLL_ZONE) return 1;
  return 0;
};
const getQueueItemLayout = (_: ArrayLike<Song> | null | undefined, index: number) => ({
  length: QUEUE_ROW_HEIGHT,
  offset: QUEUE_ROW_HEIGHT * index,
  index,
});
interface NowPlayingQueueCardProps {
  queue: Song[];
  currentSongId?: string;
  maxHeight: number;
  onPlayQueueItem: (songId: string) => void;
  onQueueShift: (fromIndex: number, toIndex: number) => void;
  canShiftQueue: boolean;
  accentColor: string;
}
interface QueueDragPosition {
  index: number;
  dragY: number;
  movementDirection: -1 | 0 | 1;
  startScrollOffset: number;
}
const NowPlayingQueueCard: React.FC<NowPlayingQueueCardProps> = ({ queue, currentSongId, maxHeight,
  onPlayQueueItem, onQueueShift, canShiftQueue, accentColor,
}) => {
  const { theme } = useAppTheme();
  const listRef = React.useRef<FlatList<Song>>(null);
  const scrollOffsetRef = React.useRef(0);
  const viewportHeightRef = React.useRef(0);
  const autoScrollDirectionRef = React.useRef<-1 | 0 | 1>(0);
  const autoScrollTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const dragPositionRef = React.useRef<QueueDragPosition | null>(null);
  const currentIndex = React.useMemo(
    () => currentSongId ? queue.findIndex(song => song.id === currentSongId) : -1,
    [currentSongId, queue],
  );
  const stopAutoScroll = React.useCallback(() => {
    autoScrollDirectionRef.current = 0;
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  }, []);
  const getScrollOffset = React.useCallback(() => scrollOffsetRef.current, []);
  const startAutoScroll = React.useCallback((direction: -1 | 1) => {
    if (autoScrollDirectionRef.current === direction && autoScrollTimerRef.current) return;
    stopAutoScroll();
    autoScrollDirectionRef.current = direction;
    autoScrollTimerRef.current = setInterval(() => {
      const drag = dragPositionRef.current;
      if (!drag || resolveQueueAutoScrollDirection({
        index: drag.index,
        dragY: drag.dragY,
        movementDirection: drag.movementDirection,
        scrollOffset: drag.startScrollOffset,
        viewportHeight: viewportHeightRef.current,
      }) !== direction) {
        stopAutoScroll();
        return;
      }
      const contentHeight = queue.length * QUEUE_ROW_HEIGHT + 16;
      const maxOffset = Math.max(0, contentHeight - viewportHeightRef.current);
      const nextOffset = Math.max(0, Math.min(maxOffset, scrollOffsetRef.current + direction * QUEUE_AUTO_SCROLL_STEP));
      if (nextOffset === scrollOffsetRef.current) {
        stopAutoScroll();
        return;
      }
      scrollOffsetRef.current = nextOffset;
      listRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
    }, QUEUE_AUTO_SCROLL_INTERVAL_MS);
  }, [queue.length, stopAutoScroll]);
  const handleDragPosition = React.useCallback((index: number, dragY: number, movementDirection: -1 | 0 | 1) => {
    const previousDrag = dragPositionRef.current;
    const startsNewDrag = !previousDrag || previousDrag.index !== index || (dragY === 0 && movementDirection === 0);
    const drag: QueueDragPosition = {
      index,
      dragY,
      movementDirection,
      startScrollOffset: startsNewDrag ? scrollOffsetRef.current : previousDrag.startScrollOffset,
    };
    dragPositionRef.current = drag;
    const direction = resolveQueueAutoScrollDirection({
      index,
      dragY,
      movementDirection,
      scrollOffset: drag.startScrollOffset,
      viewportHeight: viewportHeightRef.current,
    });
    if (direction === 0) stopAutoScroll();
    else startAutoScroll(direction);
  }, [startAutoScroll, stopAutoScroll]);
  React.useEffect(() => stopAutoScroll, [stopAutoScroll]);
  const handleScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = Math.max(0, event.nativeEvent.contentOffset.y);
  }, []);
  const renderQueueItem = React.useCallback(
    ({ item, index }: { item: Song; index: number }) => (
      <NowPlayingQueuePreviewRow
        id={item.id}
        index={index}
        queueLength={queue.length}
        rowHeight={QUEUE_ROW_HEIGHT}
        minShiftIndex={Math.max(1, currentIndex + 1)}
        getScrollOffset={getScrollOffset}
        onDragPosition={handleDragPosition}
        onDragEnd={() => { dragPositionRef.current = null; stopAutoScroll(); }}
        title={displayTitle(item)}
        artist={displayArtist(item)}
        isCurrent={!!item.id && item.id === currentSongId}
        canShift={canShiftQueue && (currentIndex < 0 || index > currentIndex)}
        onPress={onPlayQueueItem}
        onShift={onQueueShift}
        accentColor={accentColor}
      />
    ),
    [accentColor, canShiftQueue, currentIndex, currentSongId, getScrollOffset, handleDragPosition, onPlayQueueItem, onQueueShift, queue.length, stopAutoScroll],
  );
  return (
    <View style={[styles.queueListFrame, { maxHeight }]} testID="now-playing-queue-list-frame">
      {/* NativeViewGestureHandler registers the inner ScrollView with RNGH so the
          outer vertical SnapPager FlatList cannot steal scroll touches once the
          user begins scrolling inside the queue (fixes F04 / N1). */}
      <NativeViewGestureHandler disallowInterruption>
        <FlatList
          ref={listRef}
          testID="now-playing-queue-list"
          data={queue}
          keyExtractor={buildSongKey}
          renderItem={renderQueueItem}
          onLayout={event => { viewportHeightRef.current = event.nativeEvent.layout.height; }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          nestedScrollEnabled
          scrollEnabled
          showsVerticalScrollIndicator
          getItemLayout={getQueueItemLayout}
          style={styles.queueList}
          contentContainerStyle={styles.queueListContent}
          ListEmptyComponent={(
            <View style={styles.emptyState} testID="queue-empty-state">
              <Text style={[styles.emptyTitle, { color: theme.palette.text.primary }]}>Keine Titel in der Warteschlange</Text>
              <Text style={[styles.emptyText, { color: theme.palette.text.secondary }]}>Starte einen Song, um hier die Trackliste zu sehen.</Text>
            </View>
          )}
        />
      </NativeViewGestureHandler>
    </View>
  );
};
const styles = StyleSheet.create({
  queueListFrame: { flex: 1, minHeight: 0, marginHorizontal: 8 },
  queueList: { flex: 1 },
  queueListContent: { flexGrow: 1, paddingBottom: 16 },
  emptyState: { flex: 1, minHeight: 160, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyTitle: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 14, textAlign: 'center' },
  emptyText: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 12, marginTop: 6, textAlign: 'center' },
});
export default NowPlayingQueueCard;
