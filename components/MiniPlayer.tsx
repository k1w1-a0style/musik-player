import React, { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Disc3, SkipForward } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useMusicContext } from '../contexts/MusicContext';
import { theme } from '../theme';

const WaveBar: React.FC<{ delay: number; active: boolean }> = ({ delay, active }) => {
  const level = useSharedValue(0.3);
  useEffect(() => {
    if (active) {
      level.value = withRepeat(
        withSequence(withTiming(1, { duration: 260 + delay }), withTiming(0.3, { duration: 260 + delay })),
        -1,
        true,
      );
    } else {
      level.value = withTiming(0.35, { duration: 200 });
    }
  }, [active, delay, level]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: level.value }] }));
  return <Animated.View style={[styles.waveBar, style]} />;
};

const MiniPlayer: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { currentSong, isPlaying, togglePlayPause, next } = useMusicContext();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(120);

  useEffect(() => {
    y.value = withSpring(currentSong ? 0 : 120, { damping: 16, stiffness: 140 });
  }, [currentSong, y]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  if (!currentSong) return null;

  return (
    <Animated.View style={[styles.wrap, { bottom: 64 + insets.bottom + 8 }, animatedStyle]} pointerEvents="box-none">
      <Pressable onPress={onOpen} style={styles.container} testID="mini-player-open">
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.left}>
          <View style={styles.thumb}>
            {currentSong.cover ? (
              <Image source={{ uri: currentSong.cover }} style={styles.thumbImage} />
            ) : (
              <Disc3 color={theme.palette.text.muted} size={18} />
            )}
          </View>
          <View style={styles.waveWrap}>
            {[0, 1, 2].map(i => (
              <WaveBar key={i} delay={i * 55} active={isPlaying} />
            ))}
          </View>
        </View>

        <View style={styles.textWrap}>
          <Text numberOfLines={1} style={styles.title}>{currentSong.title}</Text>
          <Text numberOfLines={1} style={styles.artist}>{currentSong.artist}</Text>
        </View>

        <View style={styles.right}>
          <Pressable onPress={togglePlayPause} style={styles.playBtn}>
            <Disc3 color={theme.palette.text.onPrimary} size={18} />
          </Pressable>
          <Pressable onPress={next} style={styles.skipBtn}>
            <SkipForward color={theme.palette.text.primary} size={18} />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 50,
  },
  container: {
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(16, 19, 31, 0.95)',
    borderWidth: 1,
    borderColor: theme.palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: theme.palette.surfaceElevated,
  },
  thumbImage: { width: '100%', height: '100%' },
  waveWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 18 },
  waveBar: { width: 3, height: 16, borderRadius: 2, backgroundColor: theme.palette.primary },
  textWrap: { flex: 1 },
  title: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 14 },
  artist: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});

export default MiniPlayer;
