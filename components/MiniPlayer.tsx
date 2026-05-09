import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { Disc3, Pause, Play, SkipForward } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMiniPlayerMusicContext } from '../contexts/MusicContext';
import { theme } from '../theme';

declare const __DEV__: boolean;

const MiniPlayerComponent: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { currentSong, isPlaying, togglePlayPause, next } = useMiniPlayerMusicContext();
  const insets = useSafeAreaInsets();
  const [coverFailed, setCoverFailed] = useState(false);
  const renderCountRef = useRef(0);

  useEffect(() => {
    setCoverFailed(false);
  }, [currentSong?.id, currentSong?.cover]);

  useEffect(() => {
    if (!__DEV__ || process.env.NODE_ENV === 'test') return;
    renderCountRef.current += 1;
    if (renderCountRef.current <= 20) {
      console.debug('[perf] MiniPlayer render', {
        count: renderCountRef.current,
        currentSongId: currentSong?.id ?? null,
        isPlaying,
      });
    }
  });

  const handleTogglePlayPause = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    void togglePlayPause();
  }, [togglePlayPause]);

  const handleNext = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    void next();
  }, [next]);

  if (!currentSong) return null;
  const showCover = !!currentSong.cover && !coverFailed;

  return (
    <View style={[styles.wrap, { bottom: 72 + insets.bottom }]} pointerEvents="box-none">
      <Pressable onPress={onOpen} style={styles.container} testID="mini-player-open">
        <View style={styles.thumb}>
          {showCover ? (
            <Image source={{ uri: currentSong.cover }} style={styles.thumbImage} onError={() => setCoverFailed(true)} />
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
          <Pressable onPress={handleTogglePlayPause} style={styles.playBtn}>
            {isPlaying ? (
              <Pause color={theme.palette.text.onPrimary} size={18} />
            ) : (
              <Play color={theme.palette.text.onPrimary} size={18} />
            )}
          </Pressable>
          <Pressable onPress={handleNext} style={styles.skipBtn}>
            <SkipForward color={theme.palette.text.primary} size={18} />
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
    left: 14,
    right: 14,
    zIndex: 50,
  },
  container: {
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(8,8,8,0.94)',
    borderWidth: 1,
    borderColor: theme.palette.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: theme.palette.surfaceElevated,
  },
  thumbImage: { width: '100%', height: '100%' },
  textWrap: { flex: 1 },
  title: {
    color: theme.palette.text.primary,
    fontFamily: theme.fonts.heading,
    fontSize: 14,
  },
  artist: {
    color: theme.palette.text.secondary,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MiniPlayer;
