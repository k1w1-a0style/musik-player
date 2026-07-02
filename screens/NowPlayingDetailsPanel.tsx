import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Song } from '../types/Song';
import NowPlayingQueueCard from './NowPlayingQueueCard';

interface NowPlayingDetailsPanelProps {
  queue: Song[];
  currentSong: Song | null;
  albumTitle: string;
  accentMuted: string;
  foregroundOnAccent: string;
  listHeight: number;
  onPlayQueueItem: (songId: string) => void;
  onQueueShift: (fromIndex: number, toIndex: number) => void;
  canShiftQueue: boolean;
}

const NowPlayingDetailsPanel: React.FC<NowPlayingDetailsPanelProps> = ({
  queue,
  currentSong,
  albumTitle: _albumTitle,
  accentMuted,
  foregroundOnAccent,
  listHeight,
  onPlayQueueItem,
  onQueueShift,
  canShiftQueue,
}) => (
  <View style={styles.detailsPage} testID="now-playing-details-panel">
    <View style={styles.queueRegion}>
      <NowPlayingQueueCard
        queue={queue}
        currentSongId={currentSong?.id}
        maxHeight={listHeight}
        onPlayQueueItem={onPlayQueueItem}
        onQueueShift={onQueueShift}
        canShiftQueue={canShiftQueue}
        accentColor={accentMuted}
        activeTextColor={foregroundOnAccent}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  detailsPage: { flex: 1, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 12 },
  queueRegion: { flex: 1, minHeight: 0 },
});

export default NowPlayingDetailsPanel;
