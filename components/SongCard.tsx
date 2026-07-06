import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, type GestureResponderEvent } from 'react-native';
import { CircleEllipsis, Music2 } from 'lucide-react-native';
import type { Song } from '../types/Song';
import { theme as staticTheme } from '../theme';
import { useAppTheme } from '../contexts/AppThemeContext';
import { buildSongKey } from '../utils/libraryPresentation';
import { getSongArtworkUri } from '../utils/songArtwork';
import type { LibrarySongCardVariant } from '../utils/libraryViewMode';

interface SongCardProps {
  song: Song;
  onPressSong: (song: Song) => void;
  onInfoSong?: (song: Song) => void;
  isCurrent: boolean;
  isPlaying: boolean;
  variant?: LibrarySongCardVariant;
}

const SongCardComponent: React.FC<SongCardProps> = ({ song, onPressSong, onInfoSong, isCurrent, isPlaying, variant = 'row' }) => {
  const { theme } = useAppTheme();
  const [coverFailed, setCoverFailed] = useState(false);
  const artworkUri = getSongArtworkUri(song);
  const songTestId = song.id.trim() || buildSongKey(song);

  const selectedColors = useMemo(() => ({
    accent: theme.palette.primary,
    text: theme.palette.text.primary,
    background: theme.palette.primaryGlow,
    rail: theme.palette.borderStrong,
  }), [theme.palette.borderStrong, theme.palette.primary, theme.palette.primaryGlow, theme.palette.text.primary]);

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
  const iconSize = variant === 'banner' ? 24 : variant === 'tile' ? 26 : 17;

  const cover = (
    <View
      style={[
        styles.cover,
        {
          backgroundColor: theme.palette.surfaceGlass,
          borderColor: theme.palette.border,
        },
        variant === 'tile' && styles.tileCover,
        variant === 'banner' && styles.bannerCover,
      ]}
      testID={`song-card-cover-${songTestId}`}
    >
      {showCover ? (
        <Image source={{ uri: artworkUri }} style={styles.coverImage} onError={() => setCoverFailed(true)} resizeMode="cover" />
      ) : (
        <Music2 color={isCurrent ? selectedColors.accent : theme.palette.text.muted} size={iconSize} />
      )}
    </View>
  );

  const infoButton = onInfoSong ? (
    <Pressable
      testID={`song-card-info-${songTestId}`}
      accessibilityRole="button"
      accessibilityLabel={`Infos zu ${song.title}`}
      onPress={handleInfoPress}
      hitSlop={8}
      style={[
        styles.infoButton,
        variant === 'tile' && [
          styles.tileInfoButton,
          {
            backgroundColor: theme.palette.surfaceGlass,
            borderColor: theme.palette.border,
          },
        ],
      ]}
    >
      <CircleEllipsis color={theme.palette.text.muted} size={17} />
    </Pressable>
  ) : null;

  if (variant === 'tile') {
    return (
      <Pressable
        testID={`song-card-${songTestId}`}
        accessibilityRole="button"
        accessibilityLabel={`${song.title} von ${song.artist}`}
        accessibilityState={{ selected: isCurrent }}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.tileContainer,
          isCurrent && { backgroundColor: selectedColors.background },
          isCurrent && styles.tileCurrent,
          pressed && styles.pressed,
        ]}
      >
        <View>
          {cover}
          {infoButton}
        </View>
        <Text style={[styles.tileTitle, { color: isCurrent ? selectedColors.text : theme.palette.text.primary }]} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={[styles.tileArtist, { color: theme.palette.text.secondary }]} numberOfLines={1}>
          {song.artist}
        </Text>
      </Pressable>
    );
  }

  const isBanner = variant === 'banner';

  return (
    <Pressable
      testID={`song-card-${songTestId}`}
      accessibilityRole="button"
      accessibilityLabel={`${song.title} von ${song.artist}`}
      accessibilityState={{ selected: isCurrent }}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        { borderBottomColor: theme.palette.border },
        isBanner && styles.bannerContainer,
        isCurrent && { backgroundColor: selectedColors.background },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.activeRail,
          isCurrent && { backgroundColor: selectedColors.rail },
          isPlaying && { backgroundColor: selectedColors.accent },
        ]}
      />
      {cover}
      <View style={styles.infoContainer}>
        <Text
          style={[
            isBanner ? styles.bannerTitle : styles.title,
            { color: isCurrent ? selectedColors.text : theme.palette.text.primary },
          ]}
          numberOfLines={1}
        >
          {song.title}
        </Text>
        <Text style={[styles.artist, { color: theme.palette.text.secondary }]} numberOfLines={1}>
          {song.artist}
        </Text>
      </View>
      {infoButton}
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
    && prev.variant === next.variant
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
    gap: 10,
  },
  bannerContainer: { minHeight: 84, paddingVertical: 10 },
  pressed: { opacity: 0.72 },
  activeRail: { width: 3, height: 30, borderRadius: 3, backgroundColor: 'transparent' },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bannerCover: { width: 64, height: 64, borderRadius: 12 },
  tileCover: { width: '100%', height: undefined, aspectRatio: 1, borderRadius: 12 },
  coverImage: { width: '100%', height: '100%' },
  infoContainer: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontFamily: staticTheme.fonts.body, letterSpacing: -0.1 },
  bannerTitle: { fontSize: 17, fontFamily: staticTheme.fonts.heading, letterSpacing: -0.2 },
  artist: { fontSize: 12, marginTop: 2, fontFamily: staticTheme.fonts.body },
  infoButton: { width: 34, height: 44, alignItems: 'center', justifyContent: 'center' },
  tileInfoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileContainer: { flex: 1, maxWidth: '50%', paddingVertical: 8, paddingHorizontal: 4, gap: 6 },
  tileCurrent: { borderRadius: 12 },
  tileTitle: { fontSize: 13, fontFamily: staticTheme.fonts.body, letterSpacing: -0.1 },
  tileArtist: { fontSize: 11, fontFamily: staticTheme.fonts.body },
});

export default SongCard;
