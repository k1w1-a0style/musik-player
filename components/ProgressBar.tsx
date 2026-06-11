import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, GestureResponderEvent, LayoutChangeEvent, Pressable, type AccessibilityActionEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

interface ProgressBarProps {
  currentPosition: number;
  duration: number;
  onSeek: (position: number) => void;
  accent?: string;
  accentDark?: string;
}

export const clampPlaybackProgressValues = (currentPosition: number, duration: number): { currentPosition: number; duration: number; progress: number } => {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safePosition = Number.isFinite(currentPosition) && currentPosition > 0 ? currentPosition : 0;
  const clampedPosition = safeDuration > 0 ? Math.min(safePosition, safeDuration) : 0;
  const progress = safeDuration > 0 ? (clampedPosition / safeDuration) * 100 : 0;
  return { currentPosition: clampedPosition, duration: safeDuration, progress };
};

const SEEK_STEP_MS = 10_000;

const formatTime = (millis: number): string => {
  if (!isFinite(millis) || millis < 0) return '0:00';
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const ProgressBar: React.FC<ProgressBarProps> = ({ currentPosition, duration, onSeek, accent, accentDark }) => {
  const [barWidth, setBarWidth] = useState(0);
  const playbackProgress = clampPlaybackProgressValues(currentPosition, duration);
  const { progress } = playbackProgress;
  const { currentPosition: safeCurrentPosition, duration: safeDuration } = playbackProgress;

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  }, []);

  const handlePress = useCallback((event: GestureResponderEvent) => {
    if (barWidth <= 0 || playbackProgress.duration <= 0) return;
    const { locationX } = event.nativeEvent;
    const ratio = Math.max(0, Math.min(1, locationX / barWidth));
    onSeek(ratio * playbackProgress.duration);
  }, [barWidth, onSeek, playbackProgress.duration]);

  const handleAccessibilityAction = useCallback((event: AccessibilityActionEvent) => {
    if (safeDuration <= 0) return;

    const { actionName } = event.nativeEvent;
    if (actionName === 'increment') {
      onSeek(Math.min(safeCurrentPosition + SEEK_STEP_MS, safeDuration));
    } else if (actionName === 'decrement') {
      onSeek(Math.max(safeCurrentPosition - SEEK_STEP_MS, 0));
    }
  }, [onSeek, safeCurrentPosition, safeDuration]);

  return (
    <View style={styles.container}>
      <Pressable
        testID="progress-bar"
        accessibilityRole="adjustable"
        accessibilityLabel="Wiedergabe-Fortschritt"
        accessibilityValue={{ now: Math.round(progress), min: 0, max: 100 }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        accessibilityHint="Nach oben oder unten wischen zum Vor- oder Zurückspulen"
        onAccessibilityAction={handleAccessibilityAction}
        style={styles.progressBarContainer}
        onLayout={handleLayout}
        onPress={handlePress}
      >
        <View style={styles.progressBarBackground}>
          <LinearGradient
            colors={[accent ?? theme.palette.primary, accentDark ?? theme.palette.primaryDark]}
            style={[styles.progressBarFill, { width: `${progress}%` }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <View style={[styles.thumb, { left: `${progress}%` }]} />
        </View>
      </Pressable>
      <View style={styles.timeRow}>
        <Text style={styles.time}>{formatTime(playbackProgress.currentPosition)}</Text>
        <Text style={styles.time}>{formatTime(playbackProgress.duration)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: theme.spacing.md, marginVertical: theme.spacing.sm, width: '100%' },
  progressBarContainer: { paddingVertical: 12 },
  progressBarBackground: { height: 4, backgroundColor: theme.palette.border, borderRadius: 2 },
  progressBarFill: { height: '100%', borderRadius: 2 },
  thumb: {
    position: 'absolute', top: -5, width: 14, height: 14, borderRadius: 7,
    backgroundColor: theme.palette.primary, marginLeft: -7,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.xs },
  time: { color: theme.palette.text.secondary, fontSize: 11, fontFamily: theme.fonts.body, letterSpacing: 0.5 },
});

export default ProgressBar;
