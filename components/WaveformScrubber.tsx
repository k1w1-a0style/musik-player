import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import type { SongWaveform } from '../utils/waveformTypes';

interface WaveformScrubberProps {
  waveform: SongWaveform;
  currentPosition: number;
  duration: number;
  /** Called once on release/commit with the final seek position in ms. Triggers native seekTo. */
  onSeek: (position: number) => void;
  /** Called during drag for local UI preview only (position in ms). Must NOT trigger native seekTo. */
  onSeekPreview?: (position: number) => void;
  accent: string;
  restColor?: string;
  height?: number;
}

const LIVE_PREVIEW_THROTTLE_MS = 90;

export const clampWaveformRatio = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

const formatTime = (millis: number): string => {
  if (!Number.isFinite(millis) || millis < 0) return '0:00';
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const ratioFromEvent = (event: GestureResponderEvent, width: number): number => {
  if (!Number.isFinite(width) || width <= 0) return 0;
  return clampWaveformRatio(event.nativeEvent.locationX / width);
};

const WaveformScrubber: React.FC<WaveformScrubberProps> = ({
  waveform,
  currentPosition,
  duration,
  onSeek,
  onSeekPreview,
  accent,
  restColor,
  height = 58,
}) => {
  const { theme } = useAppTheme();
  const resolvedRestColor = restColor ?? theme.palette.borderStrong;
  const widthRef = useRef(0);
  const latestRatioRef = useRef(0);
  const lastPreviewAtRef = useRef(0);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : waveform.durationMs;
  const safePosition = safeDuration > 0 ? Math.min(Math.max(0, currentPosition), safeDuration) : 0;
  const baseRatio = safeDuration > 0 ? safePosition / safeDuration : 0;
  const displayRatio = dragRatio ?? baseRatio;
  const displayPosition = displayRatio * safeDuration;

  const bars = useMemo(() => {
    const points = waveform.points.length > 0 ? waveform.points : [0.08];
    const gap = 2;
    const barWidth = 3;
    const svgWidth = points.length * barWidth + Math.max(0, points.length - 1) * gap;
    return { points, gap, barWidth, svgWidth };
  }, [waveform.points]);

  // Preview: updates local dragRatio state + fires throttled onSeekPreview (position in ms).
  // Never calls onSeek during drag.
  const previewRatio = useCallback((ratio: number) => {
    latestRatioRef.current = ratio;
    setDragRatio(ratio);
    const now = Date.now();
    if (now - lastPreviewAtRef.current >= LIVE_PREVIEW_THROTTLE_MS) {
      lastPreviewAtRef.current = now;
      onSeekPreview?.(ratio * safeDuration);
    }
  }, [onSeekPreview, safeDuration]);

  const startInteraction = useCallback((event: GestureResponderEvent) => {
    const ratio = ratioFromEvent(event, widthRef.current);
    latestRatioRef.current = ratio;
    lastPreviewAtRef.current = 0;
    setDragRatio(ratio);
    // Fire initial preview (position in ms, no native seek)
    onSeekPreview?.(ratio * safeDuration);
  }, [onSeekPreview, safeDuration]);

  // Commit: fires onSeek exactly once with the final position in ms. No throttle.
  const finishInteraction = useCallback(() => {
    if (safeDuration > 0) onSeek(latestRatioRef.current * safeDuration);
    setDragRatio(null);
  }, [onSeek, safeDuration]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    widthRef.current = event.nativeEvent.layout.width;
  }, []);

  return (
    <View style={styles.root} testID="waveform-scrubber">
      <View
        style={[styles.waveformSurface, { height }]}
        onLayout={handleLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={startInteraction}
        onResponderMove={event => previewRatio(ratioFromEvent(event, widthRef.current))}
        onResponderRelease={finishInteraction}
        onResponderTerminate={finishInteraction}
        accessibilityRole="adjustable"
        accessibilityLabel="Audiospur-Fortschritt"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(displayRatio * 100) }}
      >
        <Svg width="100%" height={height} viewBox={`0 0 ${bars.svgWidth} ${height}`} preserveAspectRatio="none">
          {bars.points.map((point, index) => {
            const barHeight = Math.max(4, point * height);
            const x = index * (bars.barWidth + bars.gap);
            const y = (height - barHeight) / 2;
            const barRatio = bars.points.length <= 1 ? 0 : index / (bars.points.length - 1);
            return (
              <Rect
                key={`${waveform.sourceKey}-${index}`}
                x={x}
                y={y}
                width={bars.barWidth}
                height={barHeight}
                rx={1.5}
                fill={barRatio <= displayRatio ? accent : resolvedRestColor}
              />
            );
          })}
        </Svg>
      </View>
      <View style={styles.timeRow}>
        <Text style={[styles.time, { color: theme.palette.text.muted }]}>{formatTime(displayPosition)}</Text>
        <Text style={[styles.time, { color: theme.palette.text.muted }]}>{formatTime(safeDuration)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { paddingHorizontal: APP_THEME_TOKENS.spacing.md, marginVertical: APP_THEME_TOKENS.spacing.sm, width: '100%' },
  waveformSurface: { justifyContent: 'center', overflow: 'hidden', paddingVertical: 4 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  time: { fontSize: 11, fontFamily: APP_THEME_TOKENS.fonts.body },
});

export default WaveformScrubber;
