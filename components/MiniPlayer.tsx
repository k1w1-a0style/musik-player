import React, { memo, useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { Disc3, ListMusic, Pause, Play, SkipBack, SkipForward } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMiniPlayerMusicContext } from '../contexts/MusicContext';
import { theme } from '../theme';
import { getSongArtworkUri } from '../utils/songArtwork';

const MiniPlayerComponent: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { currentSong, isPlaying, togglePlayPause, next, canSkipNext } = useMiniPlayerMusicContext();
  const insets = useSafeAreaInsets();
  const [coverFailed, setCoverFailed] = useState(false);
  const artworkUri = getSongArtworkUri(currentSong);

  useEffect(() => {
    setCoverFailed(false);
  }, [currentSong?.id, artworkUri]);

  const handleTogglePlayPause = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    void togglePlayPause();
  }, [togglePlayPause]);

  const handleNext = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    if (!canSkipNext) return;
    void next();
  }, [canSkipNext, next]);

  if (!currentSong) return null;
  const showCover = !!artworkUri && !coverFailed;

  return (
    <View style={[styles.wrap, { bottom: 72 + insets.bottom }]} pointerEvents="box-none">
      <Pressable onPress={onOpen} style={styles.container} testID="mini-player-open" accessibilityRole="button" accessibilityLabel="Now Playing öffnen">
        <View style={styles.thumb}>
          {showCover ? (
            <Image source={{ uri: artworkUri }} style={styles.thumbImage} onError={() => setCoverFailed(true)} />
          ) : (
            <Disc3 color={theme.palette.text.muted} size={18} />
          )}
        </View>

        <View style={styles.textWrap}>
          <Text numberOfLines={1} style={styles.title}>
            {currentSong.title}
          </Text>
          <Text numberOfLines={1} style={styles.artist}>
            {currentSong.artist}
          </Text>
        </View>

        <View style={styles.right}>
          <SkipBack color={theme.palette.text.primary} size={21} opacity={0.55} />
          <Pressable testID="mini-player-play-pause" accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pausieren' : 'Abspielen'} onPress={handleTogglePlayPause} style={styles.playBtn}>
            {isPlaying ? (
              <Pause color={theme.palette.text.primary} size={22} />
            ) : (
              <Play color={theme.palette.text.primary} size={22} />
            )}
          </Pressable>
          <Pressable
            testID="mini-player-next"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSkipNext }}
            onPress={handleNext}
            style={!canSkipNext && styles.disabled}
          >
            <SkipForward color={theme.palette.text.primary} size={21} />
          </Pressable>
          <ListMusic color={theme.palette.text.primary} size={22} opacity={0.85} />
        </View>
      </Pressable>
    </View>
  );
};

const MiniPlayer = memo(MiniPlayerComponent);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 50,
  },
  container: {
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(20, 22, 24, 0.96)',
    borderWidth: 1.4,
    borderColor: 'rgba(115, 230, 210, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
  },
  thumb: {
    width: 50,
    height: 50,
    borderRadius: 18,
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
    fontSize: 17,
  },
  artist: {
    color: theme.palette.text.secondary,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
});

export default MiniPlayer;
