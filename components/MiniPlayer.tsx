import React, { memo, useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { Disc3, ListMusic, Pause, Play, SkipBack, SkipForward } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMiniPlayerMusicContext } from '../contexts/MusicContext';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import { useAppTheme } from '../contexts/AppThemeContext';
import { displayArtist, displayTitle } from '../utils/libraryPresentation';
import { getSongArtworkUri } from '../utils/songArtwork';
import MiniPlayerProgress from './MiniPlayerProgress';
import { useMiniPlayerProgress } from '../hooks/useMiniPlayerProgress';

const MiniPlayerComponent: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { currentSong, isPlaying, togglePlayPause, next, previous, canSkipNext, canSkipPrevious } = useMiniPlayerMusicContext();
  const insets = useSafeAreaInsets();
  const { theme: appTheme } = useAppTheme();
  const [coverFailed, setCoverFailed] = useState(false);
  const progress = useMiniPlayerProgress();
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
      <Pressable onPress={onOpen} style={[styles.container, { backgroundColor: appTheme.palette.surfaceGlass, borderColor: appTheme.palette.borderStrong }]} testID="mini-player-open" accessibilityRole="button" accessibilityLabel="Wiedergabe öffnen">
        <View style={[styles.thumb, { backgroundColor: appTheme.palette.surfaceElevated }]}>
          {showCover ? (
            <Image source={{ uri: artworkUri }} style={styles.thumbImage} onError={() => setCoverFailed(true)} />
          ) : (
            <Disc3 color={appTheme.palette.text.muted} size={18} />
          )}
        </View>

        <View style={styles.textWrap}>
          <Text numberOfLines={1} style={[styles.title, { color: appTheme.palette.text.primary }]}>
            {displayTitleText}
          </Text>
          <Text numberOfLines={1} style={[styles.artist, { color: appTheme.palette.text.secondary }]}>
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
            <SkipBack color={appTheme.palette.text.primary} size={18} />
          </Pressable>
          <Pressable testID="mini-player-play-pause" accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pausieren' : 'Abspielen'} onPress={handleTogglePlayPause} style={styles.playBtn}>
            {isPlaying ? (
              <Pause color={appTheme.palette.text.primary} size={19} />
            ) : (
              <Play color={appTheme.palette.text.primary} size={19} />
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
            <SkipForward color={appTheme.palette.text.primary} size={18} />
          </Pressable>
          <Pressable testID="mini-player-queue" accessibilityRole="button" accessibilityLabel="Warteschlange öffnen" onPress={(event) => { event.stopPropagation(); onOpen(); }}>
            <ListMusic color={appTheme.palette.text.primary} size={19} opacity={0.85} />
          </Pressable>
        </View>
        <MiniPlayerProgress progress={progress} />
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
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 10,
    overflow: 'hidden',
  },
  thumb: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  textWrap: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: staticTokens.fonts.heading,
    fontSize: 14,
  },
  artist: {
    fontFamily: staticTokens.fonts.body,
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
