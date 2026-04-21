import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

interface Playlist {
  id: string;
  name: string;
  songs: string[];
}

interface Props {
  playlist: Playlist;
  onPress?: () => void;
}

const PlaylistCard: React.FC<Props> = ({ playlist, onPress }) => {
  return (
    <TouchableOpacity
      testID={`playlist-card-${playlist.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Playlist ${playlist.name}`}
      style={styles.container}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={styles.name}>{playlist.name}</Text>
      <Text style={styles.meta}>{playlist.songs.length} Titel</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  name: { color: theme.palette.text.primary, fontSize: 16, fontWeight: '700' },
  meta: { color: theme.palette.text.secondary, fontSize: 12, marginTop: 4 },
});

export default PlaylistCard;
