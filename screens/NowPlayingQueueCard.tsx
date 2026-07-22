import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { NativeViewGestureHandler } from 'react-native-gesture-handler';
import type { Song } from '../types/Song';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { buildSongKey, displayArtist, displayTitle } from '../utils/libraryPresentation';
import NowPlayingQueuePreviewRow from './NowPlayingQueuePreviewRow';

const QUEUE_ROW_HEIGHT = 44;
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

const NowPlayingQueueCard: React.FC<NowPlayingQueueCardProps> = ({
  queue,
  currentSongId,
  maxHeight,
  onPlayQueueItem,
  onQueueShift,
  canShiftQueue,
  accentColor,
}) => {
  const { theme } = useAppTheme();

  const currentIndex = React.useMemo(
    () => currentSongId ? queue.findIndex(song => song.id === currentSongId) : -1,
    [currentSongId, queue],
  );

  const renderQueueItem = React.useCallback(
    ({ item, index }: { item: Song; index: number }) => (
      <NowPlayingQueuePreviewRow
        id={item.id}
        index={index}
        queueLength={queue.length}
        rowHeight={QUEUE_ROW_HEIGHT}
        title={displayTitle(item)}
        artist={displayArtist(item)}
        isCurrent={!!item.id && item.id === currentSongId}
        canShift={canShiftQueue && (currentIndex < 0 || index > currentIndex)}
        onPress={onPlayQueueItem}
        onShift={onQueueShift}
        accentColor={accentColor}
      />
    ),
    [accentColor, canShiftQueue, currentIndex, currentSongId, onPlayQueueItem, onQueueShift, queue.length],
  );

  return (
    <View style={[styles.queueListFrame, { maxHeight }]} testID="now-playing-queue-list-frame">
      {/* NativeViewGestureHandler registers the inner ScrollView with RNGH so the
          outer vertical SnapPager FlatList cannot steal scroll touches once the
          user begins scrolling inside the queue (fixes F04 / N1). */}
      <NativeViewGestureHandler disallowInterruption>
        <FlatList
          data={queue}
          keyExtractor={buildSongKey}
          renderItem={renderQueueItem}
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
