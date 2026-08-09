import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent, type NativeSyntheticEvent } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { useSoundCloudWaveformMotion } from '../hooks/useSoundCloudWaveformMotion';
import { SOUNDCLOUD_PLAYER_COLORS } from '../utils/appThemeOverlays';
import type { SongWaveform } from '../utils/waveformTypes';
import SoundCloudWaveformLayers from './SoundCloudWaveformLayers';

interface SoundCloudWaveformViewportProps {
  waveform: SongWaveform;
  currentPosition: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (position: number) => void | Promise<void>;
  accent?: string;
  height?: number;
  interactive?: boolean;
}

const clampPosition = (value: number, duration: number): number => {
  if (!Number.isFinite(value) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.max(0, Math.min(duration, value));
};

const formatTime = (millis: number): string => {
  const seconds = Math.floor(Math.max(0, Number.isFinite(millis) ? millis : 0) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const WaveformTimeRow = ({ position, duration }: { position: number; duration: number }) => (
  <View pointerEvents="none" style={styles.timeRow}>
    <Text style={styles.time}>{formatTime(position)}</Text>
    <Text style={styles.time}>{formatTime(duration)}</Text>
  </View>
);

const SoundCloudWaveformViewport: React.FC<SoundCloudWaveformViewportProps> = ({ waveform,
  currentPosition, duration, isPlaying, onSeek, accent = SOUNDCLOUD_PLAYER_COLORS.accent,
  height = 116, interactive = true,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const viewportWidth = Math.max(1, measuredWidth || windowWidth);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : waveform.durationMs;
  const safePosition = clampPosition(currentPosition, safeDuration);
  const progressRatio = safeDuration > 0 ? safePosition / safeDuration : 0;
  const stripWidth = Math.max(viewportWidth * 2.7, Math.max(1, waveform.points.length - 1) * 6 + 3);
  const travelWidth = Math.max(1, stripWidth - 3);
  const viewportCenter = viewportWidth / 2;
  const motion = useSoundCloudWaveformMotion({ progressRatio, safeDuration, safePosition,
    isPlaying, travelWidth, viewportCenter, waveformKey: waveform.sourceKey, onSeek });
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth > 0) setMeasuredWidth(current => Math.abs(current - nextWidth) > 1 ? nextWidth : current);
  }, []);
  const handleAccessibilityAction = useCallback((event: NativeSyntheticEvent<{ actionName: string }>) => {
    if (safeDuration <= 0) return;
    const direction = event.nativeEvent.actionName === 'increment' ? 1
      : event.nativeEvent.actionName === 'decrement' ? -1 : 0;
    if (direction) void onSeek(clampPosition(safePosition + direction * 10_000, safeDuration));
  }, [onSeek, safeDuration, safePosition]);
  const surface = (
    <View style={[styles.surface, { height }]} testID="soundcloud-waveform-surface" onLayout={handleLayout}
      accessible accessibilityRole="adjustable" accessibilityLabel="Waveform vor- oder zurückspulen"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progressRatio * 100) }}
      accessibilityActions={[{ name: 'increment', label: '10 Sekunden vorspulen' },
        { name: 'decrement', label: '10 Sekunden zurückspulen' }]}
      onAccessibilityAction={handleAccessibilityAction}>
      <SoundCloudWaveformLayers points={waveform.points} sourceKey={waveform.sourceKey}
        stripWidth={stripWidth} height={height} viewportCenter={viewportCenter}
        accent={accent} translateX={motion.translateX} />
    </View>
  );
  return (
    <View style={styles.root} testID="soundcloud-waveform-viewport">
      {interactive ? <PanGestureHandler activeOffsetX={[-6, 6]} failOffsetY={[-18, 18]}
        onGestureEvent={motion.onGestureEvent} onHandlerStateChange={motion.onStateChange}>{surface}</PanGestureHandler> : surface}
      <WaveformTimeRow position={safePosition} duration={safeDuration} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { width: '100%' }, surface: { width: '100%', overflow: 'hidden', justifyContent: 'center' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, marginTop: 2 },
  time: { color: SOUNDCLOUD_PLAYER_COLORS.waveformTime, fontSize: 11, fontVariant: ['tabular-nums'] },
});

export default React.memo(SoundCloudWaveformViewport);
