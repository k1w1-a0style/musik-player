import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Song } from '../types/Song';
import { theme } from '../theme';

interface SongCardProps {
  song: Song;
  onPress: () => void;
  isCurrent: boolean;
}

const SongCard: React.FC<SongCardProps> = ({ song, onPress, isCurrent }) => {
  return (
    <TouchableOpacity
      testID={`song-card-${song.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${song.title} von ${song.artist}`}
      onPress={onPress}
      style={[styles.container, isCurrent && styles.currentSong]}
    >
      <View style={styles.infoContainer}>
        <Text style={[styles.title, isCurrent && styles.currentSongText]} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={[styles.artist, isCurrent && styles.currentSongSubtext]} numberOfLines={1}>
          {song.artist}
        </Text>
      </View>
      {isCurrent && <Text style={styles.playingIndicator}>▶</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.palette.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  currentSong: {
    backgroundColor: theme.palette.cardElevated,
    borderColor: theme.palette.primary,
  },
  infoContainer: { flex: 1 },
  title: { fontSize: 16, color: theme.palette.text.primary, fontWeight: '700' },
  artist: { fontSize: 14, color: theme.palette.text.secondary, marginTop: 2 },
  currentSongText: { color: theme.palette.primary },
  currentSongSubtext: { color: theme.palette.text.primary },
  playingIndicator: {
    fontSize: 16,
    color: theme.palette.primary,
    marginLeft: theme.spacing.md,
  },
});

export default SongCard;
