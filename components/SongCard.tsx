import React, { memo, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, type GestureResponderEvent } from 'react-native';
import { CircleEllipsis, Music2 } from 'lucide-react-native';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import { getSongArtworkUri } from '../utils/songArtwork';

interface SongCardProps {
  song: Song;
  onPressSong: (song: Song) => void;
  onInfoSong?: (song: Song) => void;
  isCurrent: boolean;
  isPlaying: boolean;
}

const SongCardComponent: React.FC<SongCardProps> = ({ song, onPressSong, onInfoSong, isCurrent, isPlaying }) => {
  const [coverFailed, setCoverFailed] = useState(false);
  const artworkUri = getSongArtworkUri(song);

  useEffect(() => {
    setCoverFailed(false);
  }, [song.id, artworkUri]);

  const handlePress = useCallback(() => {
    onPressSong(song);
  }, [onPressSong, song]);

  const handleInfoPress = useCallback((event?: GestureResponderEvent) => {
    event?.stopPropagation();
    onInfoSong?.(song);
  }, [onInfoSong, song]);

  const showCover = !!artworkUri && !coverFailed;

  return (
    <Pressable
      testID={`song-card-${song.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${song.title} von ${song.artist}`}
      onPress={handlePress}
      style={({ pressed }) => [styles.container, isCurrent && styles.currentSong, pressed && styles.pressed]}
    >
      <View style={[styles.cover, isCurrent && styles.coverActive]}>
        {showCover ? (
          <Image source={{ uri: artworkUri }} style={styles.coverImage} onError={() => setCoverFailed(true)} />
        ) : (
          <Music2 color={isCurrent ? theme.palette.primary : theme.palette.text.muted} size={20} />
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={[styles.title, isCurrent && styles.currentSongText]} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {song.artist}
          {song.album ? ` · ${song.album}` : ''}
        </Text>
      </View>

      {onInfoSong ? (
        <Pressable testID={`song-card-info-${song.id}`} accessibilityRole="button" accessibilityLabel={`Infos zu ${song.title}`} onPress={handleInfoPress} hitSlop={8} style={styles.infoButton}>
          <CircleEllipsis color={theme.palette.text.muted} size={18} />
        </Pressable>
      ) : null}

      {isCurrent && <View style={[styles.dot, isPlaying && styles.dotActive]} />}
    </Pressable>
  );
};

const SongCard = memo(
  SongCardComponent,
  (prev, next) =>
    prev.song.id === next.song.id
    && prev.song.title === next.song.title
    && prev.song.artist === next.song.artist
    && prev.song.album === next.song.album
    && getSongArtworkUri(prev.song) === getSongArtworkUri(next.song)
    && prev.isCurrent === next.isCurrent
    && prev.isPlaying === next.isPlaying
    && prev.onPressSong === next.onPressSong
    && prev.onInfoSong === next.onInfoSong,
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    backgroundColor: theme.palette.card,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    gap: 12,
  },
  pressed: { opacity: 0.78 },
  currentSong: { borderColor: theme.palette.borderStrong },
  cover: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: theme.palette.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverActive: { borderWidth: 1, borderColor: theme.palette.primary },
  coverImage: { width: '100%', height: '100%' },
  infoContainer: { flex: 1 },
  title: {
    fontSize: 15,
    color: theme.palette.text.primary,
    fontFamily: theme.fonts.heading,
  },
  artist: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 2,
    fontFamily: theme.fonts.body,
  },
  currentSongText: { color: theme.palette.primary },
  infoButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: 8,
    height: 26,
    borderRadius: 8,
    backgroundColor: theme.palette.primaryGlow,
  },
  dotActive: { backgroundColor: theme.palette.primary },
});

export default SongCard;
