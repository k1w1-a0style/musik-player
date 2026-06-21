import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import { buildSongKey, displayArtist, normalizeLibraryText } from '../utils/libraryPresentation';
import NowPlayingQueuePreviewRow from './NowPlayingQueuePreviewRow';

const QUEUE_ROW_HEIGHT = 44;
const getQueueItemLayout = (_: ArrayLike<Song> | null | undefined, index: number) => ({ length: QUEUE_ROW_HEIGHT, offset: QUEUE_ROW_HEIGHT * index, index });

interface NowPlayingQueueCardFinalProps {
  queue: Song[];
  currentSongId?: string;
  maxHeight: number;
  onPlayQueueItem: (songId: string) => void;
  onQueueShift: (fromIndex: number, toIndex: number) => void;
  canShiftQueue: boolean;
}

const NowPlayingQueueCardFinal: React.FC<NowPlayingQueueCardFinalProps> = ({ queue, currentSongId, maxHeight, onPlayQueueItem, onQueueShift, canShiftQueue }) => {
  const renderQueueItem = React.useCallback(
    ({ item, index }: { item: Song; index: number }) => (
      <NowPlayingQueuePreviewRow
        id={item.id}
        index={index}
        title={normalizeLibraryText(item.title) || 'Unbekannter Titel'}
        artist={displayArtist(item)}
        isCurrent={!!item.id && item.id === currentSongId}
        canShift={canShiftQueue && index > 0}
        canShiftUp={canShiftQueue && index > 1}
        canShiftDown={canShiftQueue && index > 0 && index < queue.length - 1}
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
      {canShiftQueue ? <Text style={styles.queueHint}>Reihenfolge per Halten und Pfeilen bearbeiten.</Text> : null}
      <FlatList data={queue} keyExtractor={buildSongKey} renderItem={renderQueueItem} nestedScrollEnabled showsVerticalScrollIndicator={queue.length > 3} getItemLayout={getQueueItemLayout} style={styles.queueList} />
    </View>
  );
};

const styles = StyleSheet.create({
  queueCard: { marginHorizontal: 16, marginTop: 4, padding: 12, borderRadius: theme.radii.card, backgroundColor: theme.palette.surfaceGlass, borderWidth: 1, borderColor: theme.palette.border },
  queueHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  queueEyebrow: { color: theme.palette.primary, fontFamily: theme.fonts.heading, fontSize: 11, letterSpacing: 1.4 },
  queueCount: { color: theme.palette.text.muted, fontFamily: theme.fonts.body, fontSize: 11 },
  queueHint: { color: theme.palette.text.muted, fontFamily: theme.fonts.body, fontSize: 10, marginBottom: 6 },
  queueList: { maxHeight: QUEUE_ROW_HEIGHT * 4.4 },
});

export default NowPlayingQueueCardFinal;
