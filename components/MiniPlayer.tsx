import React, { memo, useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { Disc3, ListMusic, Pause, Play, SkipBack, SkipForward } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMiniPlayerMusicContext } from '../contexts/MusicContext';
import { theme } from '../theme';
import { displayArtist, displayTitle } from '../utils/libraryPresentation';
import { getSongArtworkUri } from '../utils/songArtwork';

const MiniPlayerComponent: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { currentSong, isPlaying, togglePlayPause, next, previous, canSkipNext, canSkipPrevious } = useMiniPlayerMusicContext();
  const insets = useSafeAreaInsets();
  const [coverFailed, setCoverFailed] = useState(false);
  const artworkUri = getSongArtworkUri(currentSong);
  const displayTitleText = currentSong ? displayTitle(currentSong) : 'Unbekannter Titel';
  const displayArtistName = currentSong ? displayArtist(currentSong) : '';

  useEffect(() => {
    setCoverFailed(false);
  }, [currentSong?.id, artworkUri]);

  const handleTogglePlayPause = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    void togglePlayPause();
  }, [togglePlayPause]);

  const handlePrevious = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    if (!canSkipPrevious) return;
    void previous();
  }, [canSkipPrevious, previous]);

  const handleNext = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    if (!canSkipNext) return;
    void next();
  }, [canSkipNext, next]);

  if (!currentSong) return null;
  const showCover = !!artworkUri && !coverFailed;

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
      <Pressable onPress={onOpen} style={styles.container} testID="mini-player-open" accessibilityRole="button" accessibilityLabel="Wiedergabe öffnen">
        <View style={styles.thumb}>
          {showCover ? (
            <Image source={{ uri: artworkUri }} style={styles.thumbImage} onError={() => setCoverFailed(true)} />
          ) : (
            <Disc3 color={theme.palette.text.muted} size={18} />
          )}
        </View>

        <View style={styles.textWrap}>
          <Text numberOfLines={1} style={styles.title}>
            {displayTitleText}
          </Text>
          <Text numberOfLines={1} style={styles.artist}>
            {displayArtistName}
          </Text>
        </View>

        <View style={styles.right}>
          <Pressable
            testID="mini-player-previous"
            accessibilityRole="button"
            accessibilityLabel="Vorheriger Titel"
            accessibilityState={{ disabled: !canSkipPrevious }}
            onPress={handlePrevious}
            style={!canSkipPrevious && styles.disabled}
          >
            <SkipBack color={theme.palette.text.primary} size={18} />
          </Pressable>
          <Pressable testID="mini-player-play-pause" accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pausieren' : 'Abspielen'} onPress={handleTogglePlayPause} style={styles.playBtn}>
            {isPlaying ? (
              <Pause color={theme.palette.text.primary} size={19} />
            ) : (
              <Play color={theme.palette.text.primary} size={19} />
            )}
          </Pressable>
          <Pressable
            testID="mini-player-next"
            accessibilityRole="button"
            accessibilityLabel="Nächster Titel"
            accessibilityState={{ disabled: !canSkipNext }}
            onPress={handleNext}
            style={!canSkipNext && styles.disabled}
          >
            <SkipForward color={theme.palette.text.primary} size={18} />
          </Pressable>
          <Pressable testID="mini-player-queue" accessibilityRole="button" accessibilityLabel="Warteschlange öffnen" onPress={(event) => { event.stopPropagation(); onOpen(); }}>
            <ListMusic color={theme.palette.text.primary} size={19} opacity={0.85} />
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
};

const MiniPlayer = memo(MiniPlayerComponent);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 50,
  },
  container: {
    height: 58,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 22, 24, 0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 10,
  },
  thumb: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: theme.palette.surfaceElevated,
  },
  thumbImage: { width: '100%', height: '100%' },
  textWrap: { flex: 1, minWidth: 0 },
  title: {
    color: theme.palette.text.primary,
    fontFamily: theme.fonts.heading,
    fontSize: 14,
  },
  artist: {
    color: theme.palette.text.secondary,
    fontFamily: theme.fonts.body,
    fontSize: 11,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
});

export default MiniPlayer;
