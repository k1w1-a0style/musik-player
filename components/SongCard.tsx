import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Disc3, Music2 } from 'lucide-react-native';
import type { Song } from '../types/Song';
import { theme } from '../theme';

interface SongCardProps {
  song: Song;
  onPress: () => void;
  isCurrent: boolean;
}

const SongCard: React.FC<SongCardProps> = ({ song, onPress, isCurrent }) => {
  return (
    <Pressable
      testID={`song-card-${song.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${song.title} von ${song.artist}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        isCurrent && styles.currentSong,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[styles.cover, isCurrent && styles.coverActive]}
        testID={`song-card-cover-${song.id}`}
      >
        {song.cover ? (
          <Image source={{ uri: song.cover }} style={styles.coverImage} />
        ) : (
          <Music2
            color={isCurrent ? theme.palette.primary : theme.palette.text.muted}
            size={22}
          />
        )}
      </View>
      <View style={styles.infoContainer}>
        <Text style={[styles.title, isCurrent && styles.currentSongText]} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={[styles.artist, isCurrent && styles.currentSongSubtext]} numberOfLines={1}>
          {song.artist}
          {song.album ? ` · ${song.album}` : ''}
        </Text>
      </View>
      {isCurrent && (
        <View style={styles.indicator} testID={`song-card-playing-${song.id}`}>
          <Disc3 color={theme.palette.primary} size={18} />
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.palette.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.palette.border,
    gap: theme.spacing.md,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  currentSong: {
    backgroundColor: theme.palette.surfaceElevated,
    borderColor: theme.palette.primary,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.palette.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  coverActive: {
    borderColor: theme.palette.primary,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  infoContainer: { flex: 1 },
  title: {
    fontSize: 15,
    color: theme.palette.text.primary,
    fontFamily: theme.fonts.heading,
    letterSpacing: -0.2,
  },
  artist: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 2,
    fontFamily: theme.fonts.body,
  },
  currentSongText: { color: theme.palette.primary },
  currentSongSubtext: { color: theme.palette.text.primary },
  indicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.primaryGlow,
  },
});

export default SongCard;
