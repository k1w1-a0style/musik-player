import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { AudioLines, CircleEllipsis } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Song } from '../types/Song';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import { useAppTheme } from '../contexts/AppThemeContext';
import { buildSongKey } from '../utils/libraryPresentation';
import { getArtworkSource, getSongArtworkUri, getSongArtworkRevision } from '../utils/songArtwork';
import { getSongCardMetadataLabel } from '../utils/songCardMetadata';
import type { LibrarySongCardVariant } from '../utils/libraryViewMode';
import SongWaveformStatus from './SongWaveformStatus';
import { getSongCardHeight } from '../utils/libraryRendererHelpers';
import { useArtworkThumbnail } from '../hooks/useArtworkThumbnail';
import { useSongPreparation } from '../hooks/useSongPreparation';

interface SongCardProps {
  song: Song;
  onPressSong: (song: Song) => void;
  onInfoSong?: (song: Song) => void;
  isCurrent: boolean;
  isPlaying: boolean;
  variant?: LibrarySongCardVariant;
}

const sameFields = (left: object | undefined, right: object | undefined): boolean => {
  if (left === right) return true;
  if (!left || !right) return false;
  const fields = Object.keys(left);
  const leftFields = left as Record<string, unknown>;
  const rightFields = right as Record<string, unknown>;
  return fields.length === Object.keys(right).length && fields.every(field => leftFields[field] === rightFields[field]);
};

// Compare the whole immutable Song contract, including physical revisions and
// metadata used by action callbacks, without forcing equal display copies to rerender.
const sameSong = (left: Song, right: Song): boolean => {
  if (left === right) return true;
  const { fileInfo: leftFile, audioInfo: leftAudio, coverInfo: leftCover, ...leftFields } = left;
  const { fileInfo: rightFile, audioInfo: rightAudio, coverInfo: rightCover, ...rightFields } = right;
  return sameFields(leftFields, rightFields) && sameFields(leftFile, rightFile)
    && sameFields(leftAudio, rightAudio) && sameFields(leftCover, rightCover);
};

const SongMetadata = ({ song, label, color, tile = false }: {
  song: Song; label: string | null; color: string; tile?: boolean;
}) => {
  if (!label) return null;
  return <Text style={[tile ? styles.tileMetadata : styles.metadata, { color }]} numberOfLines={1}
    testID={`song-card-meta-${song.id.trim() || buildSongKey(song)}`}>{label}</Text>;
};

const EmptySongInfoSlot = ({ variant }: { variant: LibrarySongCardVariant }) =>
  <View style={[styles.infoButton, variant === 'tile' && styles.tileInfoButton]} />;

const useSongCardArtwork = (song: Song, variant: LibrarySongCardVariant) => {
  const [coverFailed, setCoverFailed] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const artworkUri = getSongArtworkUri(song);
  const thumbnailUri = useArtworkThumbnail(artworkUri, variant === 'tile' ? 256 : 128, getSongArtworkRevision(song));
  const visibleArtworkUri = thumbnailFailed ? artworkUri : thumbnailUri;
  const artworkSource = useMemo(
    () => getArtworkSource(coverFailed ? undefined : visibleArtworkUri), [visibleArtworkUri, coverFailed]);
  useEffect(() => {
    setCoverFailed(false);
    setThumbnailFailed(false);
  }, [song.id, thumbnailUri, artworkUri]);

  const onArtworkError = useCallback(() => {
    if (visibleArtworkUri !== artworkUri) setThumbnailFailed(true);
    else setCoverFailed(true);
  }, [artworkUri, visibleArtworkUri]);
  return { artworkSource, onArtworkError: artworkUri && !coverFailed ? onArtworkError : undefined };
};

const SongCardComponent: React.FC<SongCardProps> = ({ song, onPressSong, onInfoSong, isCurrent, isPlaying, variant = 'row' }) => {
  const { theme } = useAppTheme();
  const preparation = useSongPreparation(song);
  const { fontScale } = useWindowDimensions();
  const { artworkSource, onArtworkError } = useSongCardArtwork(song, variant);
  const songTestId = song.id.trim() || buildSongKey(song); const metadataLabel = getSongCardMetadataLabel(song);
  const selectedColors = useMemo(() => ({
    accent: theme.palette.primary,
    text: theme.palette.text.primary,
    background: theme.palette.primaryGlow,
    rail: theme.palette.borderStrong,
  }), [theme.palette.borderStrong, theme.palette.primary, theme.palette.primaryGlow, theme.palette.text.primary]);

  const handlePress = useCallback(() => { onPressSong(song); }, [onPressSong, song]);

  const handleInfoPress = useCallback((event?: GestureResponderEvent) => {
    event?.stopPropagation();
    onInfoSong?.(song);
  }, [onInfoSong, song]);

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
      <Image source={artworkSource} style={styles.coverImage}
        onError={onArtworkError}
        resizeMode="cover" resizeMethod="resize" fadeDuration={0} accessible={false} />
      {isPlaying ? <View style={[styles.playingBadge, { backgroundColor: theme.palette.primary }]}>
        <AudioLines size={11} color={theme.palette.surface} />
      </View> : null}
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
  ) : <EmptySongInfoSlot variant={variant} />;

  if (variant === 'tile') {
    return (
      <View style={styles.tileSlot} testID={`song-card-slot-${songTestId}`}>
      <Pressable
        testID={`song-card-${songTestId}`}
        accessibilityRole="button"
        accessibilityLabel={`${song.title} von ${song.artist}`}
        accessibilityState={{ selected: isCurrent }}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.tileContainer,
          { backgroundColor: theme.palette.surfaceGlass, borderColor: theme.palette.border },
          isCurrent && { backgroundColor: selectedColors.background, borderColor: selectedColors.accent },
          isCurrent && styles.tileCurrent,
          pressed && styles.pressed,
        ]}
      >
        <View testID={`song-card-content-${songTestId}`}
          style={styles.tileContent}>
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
          <SongMetadata song={song} label={metadataLabel}
            color={theme.palette.text.muted} tile />
        </View>
        <SongWaveformStatus song={song} status={preparation} />
      </Pressable>
      </View>
    );
  }

  const isBanner = variant === 'banner';

  return (
    <View style={[styles.slot, { height: getSongCardHeight(fontScale, isBanner) }]} testID={`song-card-slot-${songTestId}`}>
    <Pressable
      testID={`song-card-${songTestId}`}
      accessibilityRole="button"
      accessibilityLabel={`${song.title} von ${song.artist}`}
      accessibilityState={{ selected: isCurrent }}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: theme.palette.surfaceGlass, borderColor: theme.palette.border },
        isBanner && styles.bannerContainer,
        isCurrent && { backgroundColor: selectedColors.background, borderColor: selectedColors.accent },
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient pointerEvents="none" colors={[theme.palette.surfaceElevated, theme.palette.surface]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardSheen} />
      <View testID={`song-card-content-${songTestId}`}
        style={styles.rowContent}>
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
          <SongMetadata song={song} label={metadataLabel}
            color={theme.palette.text.muted} />
        </View>
        {infoButton}
      </View>
      <SongWaveformStatus song={song} status={preparation} />
    </Pressable>
    </View>
  );
};

const SongCard = memo(
  SongCardComponent,
  (prev, next) =>
    sameSong(prev.song, next.song)
    && prev.isCurrent === next.isCurrent
    && prev.isPlaying === next.isPlaying
    && prev.variant === next.variant
    && prev.onPressSong === next.onPressSong
    && prev.onInfoSong === next.onInfoSong,
);

const styles = StyleSheet.create({
  slot: { height: 70, marginBottom: 6 },
  tileSlot: { flex: 1, maxWidth: '50%', marginBottom: 10 },
  container: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  rowContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerContainer: { paddingVertical: 6 },
  pressed: { opacity: 0.72 },
  preparing: { opacity: 0.5 },
  activeRail: { position: 'absolute', left: -10, width: 3, height: 34, borderRadius: 3, backgroundColor: 'transparent' },
  cardSheen: { ...StyleSheet.absoluteFill, opacity: 0.42 },
  playingBadge: { position: 'absolute', right: 2, bottom: 2, width: 17, height: 17, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
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
  title: { fontSize: 15, lineHeight: 20, fontFamily: staticTokens.fonts.body, letterSpacing: -0.1 },
  bannerTitle: { fontSize: 17, lineHeight: 24, fontFamily: staticTokens.fonts.heading, letterSpacing: -0.2 },
  artist: { fontSize: 12, lineHeight: 16, marginTop: 2, fontFamily: staticTokens.fonts.body },
  metadata: { fontSize: 11, lineHeight: 15, marginTop: 2, fontFamily: staticTokens.fonts.mono, letterSpacing: 0.2 },
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
  tileContainer: { position: 'relative', overflow: 'hidden', padding: 8, gap: 6,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 14 },
  tileContent: { gap: 6 },
  tileCurrent: { borderRadius: 12 },
  tileTitle: { fontSize: 13, fontFamily: staticTokens.fonts.body, letterSpacing: -0.1 },
  tileArtist: { fontSize: 11, fontFamily: staticTokens.fonts.body },
  tileMetadata: { fontSize: 10, fontFamily: staticTokens.fonts.mono, letterSpacing: 0.2 },
});

export default SongCard;
