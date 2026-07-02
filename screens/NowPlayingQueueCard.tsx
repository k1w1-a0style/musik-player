import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import { buildSongKey, displayArtist, normalizeLibraryText } from '../utils/libraryPresentation';
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
  const renderQueueItem = React.useCallback(
    ({ item, index }: { item: Song; index: number }) => (
      <NowPlayingQueuePreviewRow
        id={item.id}
        index={index}
        queueLength={queue.length}
        rowHeight={QUEUE_ROW_HEIGHT}
        title={normalizeLibraryText(item.title) || 'Unbekannter Titel'}
        artist={displayArtist(item)}
        isCurrent={!!item.id && item.id === currentSongId}
        canShift={canShiftQueue && index > 0}
        onPress={onPlayQueueItem}
        onShift={onQueueShift}
        accentColor={accentColor}
      />
    ),
    [accentColor, canShiftQueue, currentSongId, onPlayQueueItem, onQueueShift, queue.length],
  );

  return (
    <View style={[styles.queueListFrame, { maxHeight }]} testID="now-playing-queue-list-frame">
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
            <Text style={styles.emptyTitle}>Keine Titel in der Warteschlange</Text>
            <Text style={styles.emptyText}>Starte einen Song, um hier die Trackliste zu sehen.</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  queueListFrame: { flex: 1, minHeight: 0, marginHorizontal: 8 },
  queueList: { flex: 1 },
  queueListContent: { flexGrow: 1, paddingBottom: 16 },
  emptyState: { flex: 1, minHeight: 160, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 14, textAlign: 'center' },
  emptyText: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 6, textAlign: 'center' },
});

export default NowPlayingQueueCard;
