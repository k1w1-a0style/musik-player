import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { clampMiniPlayerProgress } from '../hooks/useMiniPlayerProgress';
import { PLAYBACK_PROGRESS_UPDATE_INTERVAL_MS } from '../contexts/PlaybackProgressContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import CrossfadeLayers from './CrossfadeLayers';

interface MiniPlayerProgressProps {
  progress: number;
  accent?: string;
  duration?: number;
  isAdvancing?: boolean;
  songId?: string;
}

const MiniPlayerProgress: React.FC<MiniPlayerProgressProps> = ({ progress, accent, duration = 0, isAdvancing = false, songId }) => {
  const { theme } = useAppTheme();
  const clamped = clampMiniPlayerProgress(progress);
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const motion = useRef(new Animated.Value(clamped)).current;
  const previous = useRef({ songId, progress: clamped, duration });
  useEffect(() => {
    motion.stopAnimation();
    const old = previous.current;
    previous.current = { songId, progress: clamped, duration };
    if (old.songId !== songId) {
      // A new selection can arrive before the shared poll has reset its old
      // position. Do not briefly show the previous track's progress.
      motion.setValue(0);
      return;
    }
    if (old.progress !== clamped || old.duration !== duration || reduceMotion || duration <= 0) {
      motion.setValue(clamped);
    }
    if (!isAdvancing || reduceMotion || !Number.isFinite(duration) || duration <= 0 || clamped >= 1) return;
    const remaining = Math.min(PLAYBACK_PROGRESS_UPDATE_INTERVAL_MS, duration * (1 - clamped));
    Animated.timing(motion, { toValue: clampMiniPlayerProgress(clamped + remaining / duration),
      duration: remaining, easing: Easing.linear, useNativeDriver: true, isInteraction: false }).start();
    return () => motion.stopAnimation();
  }, [clamped, duration, isAdvancing, motion, reduceMotion, songId]);
  const translateX = useMemo(() => motion.interpolate({ inputRange: [0, 1],
    outputRange: [-width, 0], extrapolate: 'clamp' }), [motion, width]);

  return (
    <View
      pointerEvents="none"
      onLayout={event => setWidth(Math.max(0, event.nativeEvent.layout.width))}
      style={[styles.track, { backgroundColor: theme.palette.border }]}
      testID="mini-player-progress"
    >
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}
        testID="mini-player-progress-motion">
      <CrossfadeLayers value={accent ?? theme.palette.primary}
        valueKey={accent ?? theme.palette.primary} testID="mini-player-progress-color-transition"
        fill
        renderLayer={color => <View style={[styles.fill,
          { backgroundColor: color }]}
          testID="mini-player-progress-fill" />} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  fill: { height: 2, width: '100%' },
});

export default MiniPlayerProgress;
