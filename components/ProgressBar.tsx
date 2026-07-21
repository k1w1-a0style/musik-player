import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, PanResponder, type AccessibilityActionEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import { useAppTheme } from '../contexts/AppThemeContext';

interface ProgressBarProps {
  currentPosition: number;
  duration: number;
  /** Called once on release/commit with the final seek position in ms. Triggers native seekTo. */
  onSeek: (position: number) => void;
  onSeekStart?: () => void;
  /** Called during drag for local UI preview only (ratio 0-1). Must NOT trigger native seekTo. */
  onSeekPreview?: (ratio: number) => void;
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

export const clampRatio = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

export const resolveDragRatio = (startRatio: number, dx: number, width: number): number => {
  if (!Number.isFinite(width) || width <= 0) return clampRatio(startRatio);
  return clampRatio(startRatio + dx / width);
};

export const ratioToMillis = (ratio: number, duration: number): number => {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  return clampRatio(ratio) * safeDuration;
};

const SEEK_STEP_MS = 10_000;
const LIVE_SEEK_THROTTLE_MS = 80;

const formatTime = (millis: number): string => {
  if (!isFinite(millis) || millis < 0) return '0:00';
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const ProgressBar: React.FC<ProgressBarProps> = ({ currentPosition, duration, onSeek, onSeekStart, onSeekPreview, accent, accentDark }) => {
  const { theme } = useAppTheme();
  const [dragRatio, setDragRatio] = useState<number | null>(null);

  const playbackProgress = clampPlaybackProgressValues(currentPosition, duration);
  const { progress } = playbackProgress;
  const { currentPosition: safeCurrentPosition, duration: safeDuration } = playbackProgress;

  // Refs keep the once-created PanResponder reading the latest values without
  // rebuilding the responder on every render.
  const barWidthRef = useRef(0);
  const durationRef = useRef(safeDuration);
  const startRatioRef = useRef(0);
  const latestRatioRef = useRef(0);
  const lastLiveSeekRef = useRef(0);
  const onSeekRef = useRef(onSeek);
  const onSeekStartRef = useRef(onSeekStart);
  const onSeekPreviewRef = useRef(onSeekPreview);

  durationRef.current = safeDuration;
  onSeekRef.current = onSeek;
  onSeekStartRef.current = onSeekStart;
  onSeekPreviewRef.current = onSeekPreview;

  const isDragging = dragRatio !== null;
  // While dragging, the local optimistic ratio wins so the 500ms progress
  // polling cannot rubber-band the thumb back.
  const displayProgress = isDragging ? clampRatio(dragRatio as number) * 100 : progress;
  const displayPositionMillis = isDragging ? clampRatio(dragRatio as number) * safeDuration : safeCurrentPosition;

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    barWidthRef.current = e.nativeEvent.layout.width;
  }, []);

  // Commit: fires onSeek exactly once with the final position in ms. No throttle.
  const finishSeek = useCallback(() => {
    if (durationRef.current > 0) {
      const target = latestRatioRef.current * durationRef.current;
      onSeekRef.current(target);
    }
    setDragRatio(null);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        if (barWidthRef.current <= 0 || durationRef.current <= 0) return;
        const ratio = clampRatio(event.nativeEvent.locationX / barWidthRef.current);
        startRatioRef.current = ratio;
        latestRatioRef.current = ratio;
        lastLiveSeekRef.current = 0;
        setDragRatio(ratio);
        onSeekStartRef.current?.();
        // Fire initial preview with ratio only (no native seek)
        onSeekPreviewRef.current?.(ratio);
      },
      onPanResponderMove: (_event, gesture) => {
        if (barWidthRef.current <= 0 || durationRef.current <= 0) return;
        const ratio = resolveDragRatio(startRatioRef.current, gesture.dx, barWidthRef.current);
        latestRatioRef.current = ratio;
        setDragRatio(ratio);
        // Throttled preview callback (ratio only, no native seek)
        const now = Date.now();
        if (now - lastLiveSeekRef.current >= LIVE_SEEK_THROTTLE_MS) {
          lastLiveSeekRef.current = now;
          onSeekPreviewRef.current?.(ratio);
        }
      },
      onPanResponderRelease: finishSeek,
      onPanResponderTerminate: finishSeek,
    }),
  ).current;

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
      <View
        testID="progress-bar"
        accessibilityRole="adjustable"
        accessibilityLabel="Wiedergabe-Fortschritt"
        accessibilityValue={{ now: Math.round(displayProgress), min: 0, max: 100 }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        accessibilityHint="Nach oben oder unten wischen zum Vor- oder Zurückspulen"
        onAccessibilityAction={handleAccessibilityAction}
        style={styles.progressBarContainer}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        <View
          testID="progress-bar-track"
          style={[styles.progressBarBackground, { backgroundColor: theme.palette.border }]}
        >
          <LinearGradient
            testID="progress-bar-fill"
            colors={[accent ?? theme.palette.primary, accentDark ?? theme.palette.primaryDark]}
            style={[styles.progressBarFill, { width: `${displayProgress}%` }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <View
            testID="progress-bar-thumb"
            style={[
              styles.thumb,
              isDragging && styles.thumbActive,
              {
                backgroundColor: accent ?? theme.palette.primary,
                left: `${displayProgress}%`,
              },
            ]}
          />
        </View>
      </View>
      <View style={styles.timeRow}>
        <Text style={[styles.time, { color: theme.palette.text.secondary }]}>{formatTime(displayPositionMillis)}</Text>
        <Text style={[styles.time, { color: theme.palette.text.secondary }]}>{formatTime(safeDuration)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: staticTokens.spacing.md, marginVertical: staticTokens.spacing.sm, width: '100%' },
  progressBarContainer: { paddingVertical: 14 },
  progressBarBackground: { height: 4, borderRadius: 2 },
  progressBarFill: { height: '100%', borderRadius: 2 },
  thumb: {
    position: 'absolute', top: -5, width: 14, height: 14, borderRadius: 7,
    marginLeft: -7,
  },
  thumbActive: {
    top: -8, width: 20, height: 20, borderRadius: 10, marginLeft: -10,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: staticTokens.spacing.xs },
  time: { fontSize: 11, fontFamily: staticTokens.fonts.body, letterSpacing: 0.5 },
});

export default ProgressBar;
