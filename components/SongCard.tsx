import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

type SongCardProps = {
  song: {
    id: number;
    title: string;
    artist: string;
  };
  onPress: () => void;
  isCurrent: boolean;
};

const SongCard: React.FC<SongCardProps> = ({ song, onPress, isCurrent }) => {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.container, isCurrent && styles.currentSong]}>
      <View style={styles.infoContainer}>
        <Text style={[styles.title, isCurrent && styles.currentSongText]}>{song.title}</Text>
        <Text style={[styles.artist, isCurrent && styles.currentSongText]}>{song.artist}</Text>
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
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  currentSong: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
  },
  infoContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    color: theme.palette.text.primary,
    fontWeight: 'bold',
  },
  artist: {
    fontSize: 14,
    color: theme.palette.text.secondary,
  },
  currentSongText: {
    color: theme.palette.background,
  },
  playingIndicator: {
    fontSize: 20,
    color: theme.palette.background,
    marginLeft: theme.spacing.md,
  },
});

export default SongCard;
