import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import NowPlayingQueueCard from './NowPlayingQueueCard';

interface NowPlayingDetailsPanelProps {
  queue: Song[];
  currentSong: Song | null;
  albumTitle: string;
  accentMuted: string;
  foregroundOnAccent: string;
  listHeight: number;
  onPlayQueueItem: (songId: string) => void;
}

const NowPlayingDetailsPanel: React.FC<NowPlayingDetailsPanelProps> = ({
  queue,
  currentSong,
  albumTitle,
  accentMuted,
  foregroundOnAccent,
  listHeight,
  onPlayQueueItem,
}) => {
  const readableAccent = foregroundOnAccent === '#FFFFFF' ? theme.palette.text.primary : foregroundOnAccent;

  return (
    <View style={styles.detailsPage} testID="now-playing-details-panel">
      <View style={[styles.swipeHintRow, { borderColor: accentMuted }]}>
        <Text style={styles.swipeHintEyebrow}>NACH OBEN GEWISCHT</Text>
        <Text style={[styles.swipeHintTitle, { color: readableAccent }]}>Warteschlange & Details</Text>
      </View>

      <NowPlayingQueueCard
        queue={queue}
        currentSongId={currentSong?.id}
        maxHeight={listHeight}
        onPlayQueueItem={onPlayQueueItem}
      />

      <View style={[styles.detailsCard, { borderColor: accentMuted }]} testID="now-playing-details-card">
        <Text style={styles.detailsEyebrow}>METADATEN</Text>
        <Text style={styles.detailsTitle} numberOfLines={1}>{currentSong?.title ?? 'Kein Titel'}</Text>
        <Text style={styles.detailsLine} numberOfLines={1}>{currentSong?.artist ?? '—'}</Text>
        <Text style={styles.detailsLine} numberOfLines={1}>{albumTitle}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  detailsPage: { flex: 1, paddingHorizontal: 8, paddingTop: 12 },
  swipeHintRow: { marginHorizontal: 16, marginBottom: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: theme.radii.card, borderWidth: 1, backgroundColor: theme.palette.surfaceGlass },
  swipeHintEyebrow: { color: theme.palette.text.muted, fontSize: 10, letterSpacing: 1.5, fontFamily: theme.fonts.body },
  swipeHintTitle: { fontSize: 16, fontFamily: theme.fonts.heading, marginTop: 2 },
  detailsCard: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: theme.radii.card, borderWidth: 1, backgroundColor: theme.palette.surfaceGlass },
  detailsEyebrow: { color: theme.palette.primary, fontFamily: theme.fonts.heading, fontSize: 11, letterSpacing: 1.4, marginBottom: 6 },
  detailsTitle: { color: theme.palette.text.primary, fontSize: 18, fontFamily: theme.fonts.display, letterSpacing: -0.35 },
  detailsLine: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 13, marginTop: 4 },
});

export default NowPlayingDetailsPanel;
