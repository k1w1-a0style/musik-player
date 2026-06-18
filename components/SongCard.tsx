import React, { memo, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, type GestureResponderEvent } from 'react-native';
import { CircleEllipsis, Music2 } from 'lucide-react-native';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import { buildSongKey } from '../utils/libraryPresentation';
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
  const songTestId = song.id.trim() || buildSongKey(song);

  useEffect(() => {
    setCoverFailed(false);
  }, [song.id, song.cover, song.coverInfo?.uri]);


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
      testID={`song-card-${songTestId}`}
      accessibilityRole="button"
      accessibilityLabel={`${song.title} von ${song.artist}`}
      accessibilityState={{ selected: isCurrent }}
      onPress={handlePress}
      style={({ pressed }) => [styles.container, isCurrent && styles.currentSong, pressed && styles.pressed]}
    >
      <View style={[styles.activeRail, isCurrent && styles.activeRailVisible, isPlaying && styles.activeRailPlaying]} />
      <View style={styles.cover}>
        {showCover ? (
          <Image source={{ uri: artworkUri }} style={styles.coverImage} onError={() => setCoverFailed(true)} resizeMode="cover" />
        ) : (
          <Music2 color={isCurrent ? theme.palette.primary : theme.palette.text.muted} size={17} />
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={[styles.title, isCurrent && styles.currentSongText]} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {song.artist}
        </Text>
      </View>

      {onInfoSong ? (
        <Pressable testID={`song-card-info-${songTestId}`} accessibilityRole="button" accessibilityLabel={`Infos zu ${song.title}`} onPress={handleInfoPress} hitSlop={8} style={styles.infoButton}>
          <CircleEllipsis color={theme.palette.text.muted} size={17} />
        </Pressable>
      ) : null}
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
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.105)',
    gap: 10,
  },
  pressed: { opacity: 0.72 },
  currentSong: { backgroundColor: 'rgba(82, 255, 118, 0.045)' },
  activeRail: { width: 3, height: 30, borderRadius: 3, backgroundColor: 'transparent' },
  activeRailVisible: { backgroundColor: 'rgba(82, 255, 118, 0.30)' },
  activeRailPlaying: { backgroundColor: theme.palette.primary },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.105)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverImage: { width: '100%', height: '100%' },
  infoContainer: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, color: theme.palette.text.primary, fontFamily: theme.fonts.body, letterSpacing: -0.1 },
  artist: { fontSize: 12, color: theme.palette.text.secondary, marginTop: 2, fontFamily: theme.fonts.body },
  currentSongText: { color: theme.palette.primary },
  infoButton: { width: 34, height: 44, alignItems: 'center', justifyContent: 'center' },
});

export default SongCard;
