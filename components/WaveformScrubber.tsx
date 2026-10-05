import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View,
  type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { formatTime } from '../utils/musicParser';
import type { SongWaveform } from '../utils/waveformTypes';

interface WaveformScrubberProps {
  waveform: SongWaveform;
  ready?: boolean;
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

const ratioFromEvent = (event: GestureResponderEvent, width: number): number => {
  if (!Number.isFinite(width) || width <= 0) return 0;
  return clampWaveformRatio(event.nativeEvent.locationX / width);
};

const ratioFromPosition = (position: number, duration: number): number =>
  duration > 0 ? clampWaveformRatio(position / duration) : 0;

interface WaveformBarsProps {
  points: readonly number[];
  sourceKey: string;
  color: string;
  height: number;
  svgWidth: number;
  width: number | string;
  layer: 'rest' | 'played';
}

export const buildWaveformScrubberPath = (points: readonly number[], height: number): string =>
  points.map((point, index) => {
    const barHeight = Math.max(4, point * height);
    const x = index * 5 + 1.5;
    const top = (height - barHeight) / 2;
    return `M${x.toFixed(2)} ${top.toFixed(2)}V${(top + barHeight).toFixed(2)}`;
  }).join('');

const WaveformBars = React.memo(({ points, sourceKey, color, height, svgWidth,
  width, layer }: WaveformBarsProps) => {
  const path = useMemo(() => buildWaveformScrubberPath(points, height), [height, points]);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${svgWidth} ${height}`}
      preserveAspectRatio="none" testID={`waveform-${layer}-layer`}>
      <Path key={`${sourceKey}-${layer}`} d={path} fill="none" stroke={color}
        strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
});

WaveformBars.displayName = 'WaveformBars';

interface WaveformVisualProps {
  ready: boolean;
  points: readonly number[];
  svgWidth: number;
  sourceKey: string;
  restColor: string;
  accent: string;
  height: number;
  surfaceWidth: number;
  animatedRatio: Animated.Value;
}

const WaveformVisual = ({ ready, points, svgWidth, sourceKey, restColor, accent,
  height, surfaceWidth, animatedRatio }: WaveformVisualProps) => {
  const playedClipWidth = useMemo(
    () => Animated.multiply(animatedRatio, surfaceWidth),
    [animatedRatio, surfaceWidth],
  );
  return (
    <>
      {ready ? <WaveformBars points={points} sourceKey={sourceKey} color={restColor}
        height={height} svgWidth={svgWidth} width="100%" layer="rest" />
        : <View pointerEvents="none" style={[styles.loadingLine,
          { width: '100%', backgroundColor: restColor }]} testID="waveform-loading-line" />}
      <Animated.View pointerEvents="none" style={[styles.playedClip, { width: playedClipWidth }]}
        testID="waveform-played-clip">
        {ready ? <WaveformBars points={points} sourceKey={sourceKey} color={accent}
          height={height} svgWidth={svgWidth} width={Math.max(1, surfaceWidth)} layer="played" />
          : <View style={[styles.loadingLine, { width: Math.max(1, surfaceWidth),
            backgroundColor: accent }]} testID="waveform-loading-played-line" />}
      </Animated.View>
    </>
  );
};

const useHeldWaveformSeek = (animatedRatio: Animated.Value, baseRatioRef: React.MutableRefObject<number>,
  setPreviewPosition: React.Dispatch<React.SetStateAction<number | null>>, onSeek: (position: number) => void,
  draggingRef: React.MutableRefObject<boolean>, latestRatioRef: React.MutableRefObject<number>) => {
  const heldSeekRef = useRef<{ position: number; expires: number } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseHeldSeek = useCallback(() => {
    heldSeekRef.current = null;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    setPreviewPosition(null);
  }, [setPreviewPosition]);
  useEffect(() => () => {
    heldSeekRef.current = null;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
  }, []);
  const holdSeek = useCallback((position: number) => {
    releaseHeldSeek();
    const held = { position, expires: Date.now() + 2500 };
    heldSeekRef.current = held;
    setPreviewPosition(position);
    const rollback = () => {
      if (heldSeekRef.current !== held) return;
      releaseHeldSeek();
      animatedRatio.setValue(baseRatioRef.current);
    };
    holdTimerRef.current = setTimeout(rollback, 2500);
    try { void Promise.resolve(onSeek(position)).catch(rollback); }
    catch { rollback(); }
  }, [animatedRatio, baseRatioRef, onSeek, releaseHeldSeek, setPreviewPosition]);
  const cancelInteraction = useCallback(() => {
    draggingRef.current = false;
    latestRatioRef.current = baseRatioRef.current;
    animatedRatio.setValue(baseRatioRef.current);
    releaseHeldSeek();
  }, [animatedRatio, baseRatioRef, draggingRef, latestRatioRef, releaseHeldSeek]);
  return { heldSeekRef, releaseHeldSeek, holdSeek, cancelInteraction };
};

const WaveformScrubber: React.FC<WaveformScrubberProps> = ({ waveform, currentPosition, duration,
  ready = true, onSeek, onSeekPreview, accent, restColor, height = 58 }) => {
  const { theme } = useAppTheme();
  const resolvedRestColor = restColor ?? theme.palette.borderStrong;
  const widthRef = useRef(0);
  const latestRatioRef = useRef(0);
  const lastPreviewAtRef = useRef(0);
  const draggingRef = useRef(false);
  const [surfaceWidth, setSurfaceWidth] = useState(0);
  const [previewPosition, setPreviewPosition] = useState<number | null>(null);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : waveform.durationMs;
  const safePosition = safeDuration > 0 ? Math.min(Math.max(0, currentPosition), safeDuration) : 0;
  const baseRatio = ratioFromPosition(safePosition, safeDuration);
  const baseRatioRef = useRef(baseRatio);
  baseRatioRef.current = baseRatio;
  const animatedRatio = useRef(new Animated.Value(baseRatio)).current;
  const { heldSeekRef, releaseHeldSeek, holdSeek, cancelInteraction } = useHeldWaveformSeek(
    animatedRatio, baseRatioRef, setPreviewPosition, onSeek, draggingRef, latestRatioRef);

  const bars = useMemo(() => {
    const points = waveform.points.length > 0 ? waveform.points : [0.08];
    return { points, svgWidth: points.length * 3 + Math.max(0, points.length - 1) * 2 };
  }, [waveform.points]);
  useEffect(() => {
    releaseHeldSeek();
    draggingRef.current = false;
    latestRatioRef.current = baseRatioRef.current;
    animatedRatio.setValue(baseRatioRef.current);
    setPreviewPosition(null);
  }, [animatedRatio, releaseHeldSeek, waveform.sourceKey]);

  useEffect(() => {
    if (draggingRef.current) return;
    const held = heldSeekRef.current;
    if (held && Date.now() < held.expires && Math.abs(safePosition - held.position) > 750) return;
    if (held) releaseHeldSeek();
    latestRatioRef.current = baseRatio;
    animatedRatio.setValue(baseRatio);
  }, [animatedRatio, baseRatio, heldSeekRef, releaseHeldSeek, safePosition]);

  const publishPreview = useCallback((ratio: number, force = false) => {
    const position = ratio * safeDuration;
    const now = Date.now();
    if (!force && now - lastPreviewAtRef.current < LIVE_PREVIEW_THROTTLE_MS) return;
    lastPreviewAtRef.current = now;
    setPreviewPosition(position);
    onSeekPreview?.(position);
  }, [onSeekPreview, safeDuration]);

  const previewRatio = useCallback((ratio: number) => {
    latestRatioRef.current = ratio;
    animatedRatio.setValue(ratio);
    publishPreview(ratio);
  }, [animatedRatio, publishPreview]);

  const startInteraction = useCallback((event: GestureResponderEvent) => {
    releaseHeldSeek();
    const ratio = ratioFromEvent(event, widthRef.current);
    draggingRef.current = true;
    latestRatioRef.current = ratio;
    lastPreviewAtRef.current = 0;
    animatedRatio.setValue(ratio);
    publishPreview(ratio, true);
  }, [animatedRatio, publishPreview, releaseHeldSeek]);

  const finishInteraction = useCallback(() => {
    const finalRatio = latestRatioRef.current;
    draggingRef.current = false;
    animatedRatio.setValue(finalRatio);
    if (safeDuration > 0) holdSeek(finalRatio * safeDuration);
  }, [animatedRatio, holdSeek, safeDuration]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.max(0, Math.round(event.nativeEvent.layout.width));
    widthRef.current = width;
    setSurfaceWidth(current => Math.abs(current - width) > 1 ? width : current);
  }, []);

  const displayPosition = previewPosition ?? safePosition;
  const displayRatio = ratioFromPosition(displayPosition, safeDuration);

  return (
    <View style={styles.root} testID="waveform-scrubber">
      <View style={[styles.waveformSurface, { height }]} onLayout={handleLayout}
        onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
        onResponderGrant={startInteraction}
        onResponderMove={event => previewRatio(ratioFromEvent(event, widthRef.current))}
        onResponderRelease={finishInteraction} onResponderTerminate={cancelInteraction}
        accessibilityRole="adjustable" accessibilityLabel="Audiospur-Fortschritt"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(displayRatio * 100) }}>
        <WaveformVisual ready={ready} points={bars.points} svgWidth={bars.svgWidth}
          sourceKey={waveform.sourceKey} restColor={resolvedRestColor} accent={accent}
          height={height} surfaceWidth={surfaceWidth} animatedRatio={animatedRatio} />
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
  waveformSurface: { position: 'relative', justifyContent: 'center', overflow: 'hidden', paddingVertical: 4 },
  loadingLine: { position: 'absolute', left: 0, top: '50%', height: 2, marginTop: -1,
    borderRadius: 1 },
  playedClip: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden',
    alignItems: 'flex-start', justifyContent: 'center' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  time: { fontSize: 11, fontFamily: APP_THEME_TOKENS.fonts.body },
});

export default WaveformScrubber;
