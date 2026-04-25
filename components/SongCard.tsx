import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Music2 } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import type { Song } from '../types/Song';
import { theme } from '../theme';

interface SongCardProps {
  song: Song;
  onPress: () => void;
  isCurrent: boolean;
  isPlaying: boolean;
}

const PlayingBars: React.FC<{ active: boolean }> = ({ active }) => {
  const a = useSharedValue(0.3);
  const b = useSharedValue(0.3);
  const c = useSharedValue(0.3);

  useEffect(() => {
    if (active) {
      a.value = withRepeat(withSequence(withTiming(1, { duration: 280 }), withTiming(0.3, { duration: 280 })), -1, true);
      b.value = withRepeat(withSequence(withTiming(1, { duration: 350 }), withTiming(0.3, { duration: 350 })), -1, true);
      c.value = withRepeat(withSequence(withTiming(1, { duration: 420 }), withTiming(0.3, { duration: 420 })), -1, true);
    } else {
      a.value = withTiming(0.5);
      b.value = withTiming(0.7);
      c.value = withTiming(0.5);
    }
  }, [active, a, b, c]);

  const s1 = useAnimatedStyle(() => ({ transform: [{ scaleY: a.value }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ scaleY: b.value }] }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ scaleY: c.value }] }));

  return (
    <View style={styles.waveWrap}>
      <Animated.View style={[styles.waveBar, s1]} />
      <Animated.View style={[styles.waveBar, s2]} />
      <Animated.View style={[styles.waveBar, s3]} />
    </View>
  );
};

const SongCard: React.FC<SongCardProps> = ({ song, onPress, isCurrent, isPlaying }) => {
  return (
    <Pressable
      testID={`song-card-${song.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${song.title} von ${song.artist}`}
      onPress={onPress}
      style={({ pressed }) => [styles.container, isCurrent && styles.currentSong, pressed && styles.pressed]}
    >
      <View style={[styles.cover, isCurrent && styles.coverActive]}>
        {song.cover ? <Image source={{ uri: song.cover }} style={styles.coverImage} /> : <Music2 color={isCurrent ? theme.palette.primary : theme.palette.text.muted} size={22} />}
      </View>
      <View style={styles.infoContainer}>
        <Text style={[styles.title, isCurrent && styles.currentSongText]} numberOfLines={1}>{song.title}</Text>
        <Text style={[styles.artist, isCurrent && styles.currentSongSubtext]} numberOfLines={1}>{song.artist}{song.album ? ` · ${song.album}` : ''}</Text>
      </View>
      {isCurrent && <PlayingBars active={isPlaying} />}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, marginBottom: theme.spacing.sm,
    backgroundColor: theme.palette.surface, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.palette.border, gap: theme.spacing.md,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  currentSong: { backgroundColor: theme.palette.surfaceElevated, borderColor: theme.palette.primary },
  cover: { width: 44, height: 44, borderRadius: theme.borderRadius.sm, backgroundColor: theme.palette.surfaceElevated, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: theme.palette.border },
  coverActive: { borderColor: theme.palette.primary },
  coverImage: { width: '100%', height: '100%' },
  infoContainer: { flex: 1 },
  title: { fontSize: 15, color: theme.palette.text.primary, fontFamily: theme.fonts.heading, letterSpacing: -0.2 },
  artist: { fontSize: 12, color: theme.palette.text.secondary, marginTop: 2, fontFamily: theme.fonts.body },
  currentSongText: { color: theme.palette.primary },
  currentSongSubtext: { color: theme.palette.text.primary },
  waveWrap: { width: 24, height: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  waveBar: { width: 3, height: 18, borderRadius: 2, backgroundColor: theme.palette.primary },
});

export default SongCard;
