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
}

const NowPlayingQueueCard: React.FC<NowPlayingQueueCardProps> = ({
  queue,
  currentSongId,
  maxHeight,
  onPlayQueueItem,
  onQueueShift,
  canShiftQueue,
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
      />
    ),
    [canShiftQueue, currentSongId, onPlayQueueItem, onQueueShift, queue.length],
  );

  if (queue.length <= 1) return null;

  return (
    <View style={[styles.queueCard, { maxHeight }]}> 
      <View style={styles.queueHeaderRow}>
        <Text style={styles.queueEyebrow}>WARTESCHLANGE</Text>
        <Text style={styles.queueCount}>{queue.length} Titel</Text>
      </View>
      <FlatList
        data={queue}
        keyExtractor={buildSongKey}
        renderItem={renderQueueItem}
        nestedScrollEnabled
        scrollEnabled
        showsVerticalScrollIndicator={queue.length > 8}
        getItemLayout={getQueueItemLayout}
        style={styles.queueList}
        contentContainerStyle={styles.queueListContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  queueCard: { flex: 1, marginHorizontal: 16, marginTop: 4, padding: 12, borderRadius: theme.radii.card, backgroundColor: theme.palette.surfaceGlass, borderWidth: 1, borderColor: theme.palette.border },
  queueHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  queueEyebrow: { color: theme.palette.primary, fontFamily: theme.fonts.heading, fontSize: 11, letterSpacing: 1.4 },
  queueCount: { color: theme.palette.text.muted, fontFamily: theme.fonts.body, fontSize: 11 },
  queueList: { flex: 1 },
  queueListContent: { paddingBottom: 10 },
});

export default NowPlayingQueueCard;
