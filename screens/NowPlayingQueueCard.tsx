import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import NowPlayingQueuePreviewRow from './NowPlayingQueuePreviewRow';

const QUEUE_ROW_HEIGHT = 44;

interface NowPlayingQueueCardProps {
  queue: Song[];
  currentSongId?: string;
  maxHeight: number;
  onPlayQueueItem: (songId: string) => void;
}

const NowPlayingQueueCard: React.FC<NowPlayingQueueCardProps> = ({
  queue,
  currentSongId,
  maxHeight,
  onPlayQueueItem,
}) => {
  const renderQueueItem = React.useCallback(
    ({ item }: { item: Song }) => (
      <NowPlayingQueuePreviewRow
        id={item.id}
        title={item.title}
        artist={item.artist}
        isCurrent={item.id === currentSongId}
        onPress={onPlayQueueItem}
      />
    ),
    [currentSongId, onPlayQueueItem],
  );

  if (queue.length <= 1) return null;

  return (
    <View style={[styles.queueCard, { maxHeight }]}> 
      <View style={styles.queueHeaderRow}>
        <Text style={styles.queueEyebrow}>QUEUE</Text>
        <Text style={styles.queueCount}>{queue.length} Tracks</Text>
      </View>
      <FlatList
        data={queue}
        keyExtractor={item => item.id}
        renderItem={renderQueueItem}
        nestedScrollEnabled
        showsVerticalScrollIndicator={queue.length > 3}
        getItemLayout={(_, index) => ({ length: QUEUE_ROW_HEIGHT, offset: QUEUE_ROW_HEIGHT * index, index })}
        style={styles.queueList}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  queueCard: { marginHorizontal: 16, marginTop: 4, padding: 12, borderRadius: theme.radii.card, backgroundColor: theme.palette.surfaceGlass, borderWidth: 1, borderColor: theme.palette.border },
  queueHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  queueEyebrow: { color: theme.palette.primary, fontFamily: theme.fonts.heading, fontSize: 11, letterSpacing: 1.4 },
  queueCount: { color: theme.palette.text.muted, fontFamily: theme.fonts.body, fontSize: 11 },
  queueList: { maxHeight: QUEUE_ROW_HEIGHT * 4.4 },
});

export default NowPlayingQueueCard;
