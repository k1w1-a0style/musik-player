import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Disc3, Pause, Play, SkipForward } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMusicContext } from '../contexts/MusicContext';
import { theme } from '../theme';

const MiniPlayer: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { currentSong, isPlaying, togglePlayPause, next } = useMusicContext();
  const insets = useSafeAreaInsets();

  if (!currentSong) return null;

  return (
    <View style={[styles.wrap, { bottom: 72 + insets.bottom }]} pointerEvents="box-none">
      <Pressable onPress={onOpen} style={styles.container} testID="mini-player-open">
        <View style={styles.thumb}>
          {currentSong.cover ? (
            <Image source={{ uri: currentSong.cover }} style={styles.thumbImage} />
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
          <Pressable
            onPress={event => {
              event.stopPropagation();
              void togglePlayPause();
            }}
            style={styles.playBtn}
          >
            {isPlaying ? (
              <Pause color={theme.palette.text.onPrimary} size={18} />
            ) : (
              <Play color={theme.palette.text.onPrimary} size={18} />
            )}
          </Pressable>
          <Pressable
            onPress={event => {
              event.stopPropagation();
              void next();
            }}
            style={styles.skipBtn}
          >
            <SkipForward color={theme.palette.text.primary} size={18} />
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
};

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
    ...theme.shadows.glow,
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
