import React from 'react';
import { FlatList, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { NativeViewGestureHandler } from 'react-native-gesture-handler';
import { ListMusic } from 'lucide-react-native';
import type { Song } from '../types/Song';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useNowPlayingQueueDrag } from '../hooks/useNowPlayingQueueDrag';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { buildSongKey, displayArtist, displayTitle } from '../utils/libraryPresentation';
import { getSongArtworkUri } from '../utils/songArtwork';
import { getQueuePreviewOffset, SOUNDCLOUD_QUEUE_ROW_HEIGHT } from '../utils/soundCloudPlayer';
import NowPlayingQueuePreviewRow, { type NowPlayingQueueColors } from './NowPlayingQueuePreviewRow';

export { resolveQueueAutoScrollDirection } from '../utils/soundCloudPlayer';

const getQueueItemLayout = (_: ArrayLike<Song> | null | undefined, index: number) => ({
  length: SOUNDCLOUD_QUEUE_ROW_HEIGHT,
  offset: SOUNDCLOUD_QUEUE_ROW_HEIGHT * index,
  index,
});
const getInitialQueueIndex = (currentIndex: number): number | undefined => currentIndex > 0 ? currentIndex : undefined;

interface NowPlayingQueueCardProps {
  queue: Song[];
  currentSongId?: string;
  maxHeight: number;
  onPlayQueueItem: (songId: string) => void;
  onQueueShift: (fromIndex: number, toIndex: number) => void;
  canShiftQueue: boolean;
  accentColor: string;
  showHeader?: boolean;
  colors?: NowPlayingQueueColors;
}

const NowPlayingQueueHeader = ({ visible, upcomingCount, accentColor, colors }: { visible: boolean;
  upcomingCount: number; accentColor: string; colors: NowPlayingQueueColors }) => {
  if (!visible) return null;
  return (
    <View style={styles.cardHeader} testID="now-playing-queue-header">
      <View style={[styles.headerIcon, { backgroundColor: `${accentColor}18` }]}>
        <ListMusic color={accentColor} size={20} />
      </View>
      <View style={styles.headerText}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Als Nächstes</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{upcomingCount} Titel als Nächstes</Text>
      </View>
    </View>
  );
};

const QueueEmptyState = ({ colors }: { colors: NowPlayingQueueColors }) => (
    <View style={styles.emptyState} testID="queue-empty-state">
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Keine Titel in der Warteschlange</Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Starte einen Song, um hier die Trackliste zu sehen.</Text>
    </View>
);

const NowPlayingQueueCard: React.FC<NowPlayingQueueCardProps> = ({ queue, currentSongId, maxHeight,
  onPlayQueueItem, onQueueShift, canShiftQueue, accentColor, showHeader = true, colors,
}) => {
  const { theme } = useAppTheme();
  const rowColors = React.useMemo<NowPlayingQueueColors>(() => colors ?? ({
    textPrimary: theme.palette.text.primary, textSecondary: theme.palette.text.secondary,
    textMuted: theme.palette.text.muted, surfaceElevated: theme.palette.surfaceElevated,
    border: theme.palette.border,
  }), [colors, theme.palette]);
  const listRef = React.useRef<FlatList<Song>>(null);
  const scrollOffsetRef = React.useRef(0);
  const viewportHeightRef = React.useRef(0);
  const currentIndex = React.useMemo(
    () => currentSongId ? queue.findIndex(song => song.id === currentSongId) : -1,
    [currentSongId, queue],
  );
  const { dragPreview, dragScrollCompensation, minShiftIndex,
    handleDragPosition, handleDragEnd } = useNowPlayingQueueDrag({
    queueLength: queue.length, currentIndex, listRef, scrollOffsetRef, viewportHeightRef,
  });
  const getScrollOffset = React.useCallback(() => scrollOffsetRef.current, []);
  const handleScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = Math.max(0, event.nativeEvent.contentOffset.y);
  }, []);
  const renderQueueItem = React.useCallback(({ item, index }: { item: Song; index: number }) => (
    <NowPlayingQueuePreviewRow
      id={item.id} index={index} queueLength={queue.length} rowHeight={SOUNDCLOUD_QUEUE_ROW_HEIGHT}
      minShiftIndex={minShiftIndex} getScrollOffset={getScrollOffset}
      onDragPosition={handleDragPosition} onDragEnd={handleDragEnd}
      artworkUri={getSongArtworkUri(item)} previewOffsetY={dragPreview ? getQueuePreviewOffset({
        index, dragIndex: dragPreview.index, targetIndex: dragPreview.targetIndex,
        rowHeight: SOUNDCLOUD_QUEUE_ROW_HEIGHT }) : 0}
      dragScrollCompensation={dragPreview?.index === index ? dragScrollCompensation : undefined}
      title={displayTitle(item)} artist={displayArtist(item)} isCurrent={item.id === currentSongId}
      canShift={canShiftQueue && (currentIndex < 0 || index > currentIndex)}
      onPress={onPlayQueueItem} onShift={onQueueShift} accentColor={accentColor} colors={rowColors}
    />
  ), [accentColor, canShiftQueue, currentIndex, currentSongId, dragPreview,
    dragScrollCompensation, getScrollOffset, handleDragEnd, handleDragPosition, minShiftIndex,
    onPlayQueueItem, onQueueShift, queue.length, rowColors]);
  const upcomingCount = Math.max(0, queue.length - Math.max(0, currentIndex + 1));

  return (
    <View style={[styles.queueListFrame, { maxHeight }]} testID="now-playing-queue-list-frame">
      <NowPlayingQueueHeader visible={showHeader} upcomingCount={upcomingCount} accentColor={accentColor} colors={rowColors} />
      <NativeViewGestureHandler disallowInterruption>
        <FlatList ref={listRef} testID="now-playing-queue-list" data={queue} keyExtractor={buildSongKey}
          initialScrollIndex={getInitialQueueIndex(currentIndex)}
          renderItem={renderQueueItem} onLayout={event => { viewportHeightRef.current = event.nativeEvent.layout.height; }}
          onScroll={handleScroll} scrollEventThrottle={16} nestedScrollEnabled scrollEnabled
          showsVerticalScrollIndicator getItemLayout={getQueueItemLayout} style={styles.queueList}
          initialNumToRender={10} maxToRenderPerBatch={8} updateCellsBatchingPeriod={70} windowSize={7}
          contentContainerStyle={styles.queueListContent} ListEmptyComponent={<QueueEmptyState colors={rowColors} />} />
      </NativeViewGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  queueListFrame: { flex: 1, minHeight: 0, marginHorizontal: 8 },
  cardHeader: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  headerIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  headerTitle: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 18 },
  headerSubtitle: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 11, marginTop: 1 },
  queueList: { flex: 1 },
  queueListContent: { flexGrow: 1, paddingBottom: 16 },
  emptyState: { flex: 1, minHeight: 160, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyTitle: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 14, textAlign: 'center' },
  emptyText: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 12, marginTop: 6, textAlign: 'center' },
});

export default NowPlayingQueueCard;
