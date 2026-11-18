import React, { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { Song } from '../types/Song';
import { getSongProcessingPhase, subscribeSongProcessing } from '../utils/songProcessingActivity';
import { getWaveformSourceIdentity } from '../utils/waveformGenerator';
import { getWaveformProgress, subscribeWaveformStatus, type WaveformStatus } from '../utils/waveformStatus';

const phaseLabels = {
  capture: 'Titel wird erfasst',
  metadata: 'Metadaten werden gelesen',
  audioInfo: 'Audioinformationen werden gelesen',
  cover: 'Cover wird gelesen',
};

const ProcessingRail = ({ id, label, ratio }: { id: string; label: string; ratio: number | null }) => {
  const { theme } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [motion] = useState(() => new Animated.Value(ratio ?? 0));
  const indeterminate = ratio === null;
  const wasIndeterminate = useRef(indeterminate);

  useEffect(() => {
    const becameDeterminate = wasIndeterminate.current && !indeterminate;
    wasIndeterminate.current = indeterminate;
    if (becameDeterminate || reducedMotion) motion.setValue(ratio ?? 0);
    if (reducedMotion) {
      return;
    }
    if (ratio === null) {
      motion.setValue(0);
      const loop = Animated.loop(Animated.timing(motion, { toValue: 1, duration: 1200,
        easing: Easing.inOut(Easing.quad), useNativeDriver: true, isInteraction: false }));
      loop.start();
      return () => loop.stop();
    }
    const timing = Animated.timing(motion, { toValue: ratio, duration: 160,
      easing: Easing.out(Easing.quad), useNativeDriver: true, isInteraction: false });
    timing.start();
    return () => timing.stop();
  }, [indeterminate, motion, ratio, reducedMotion]);

  const translateX = useMemo(() => motion.interpolate({ inputRange: [0, 1],
    outputRange: [indeterminate ? -width * 0.35 : -width, indeterminate ? width : 0] }),
  [motion, width, indeterminate]);

  return <View testID={`song-preparation-progress-${id}`} pointerEvents="none" accessible
    accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}
    accessibilityValue={ratio === null ? undefined : { min: 0, max: 100, now: Math.round(ratio * 100) }}
    onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.track}>
    {reducedMotion || width === 0 ? <View testID={`song-preparation-progress-fill-${id}`} style={[styles.fill,
      indeterminate && styles.indeterminateStatic,
      { width: `${ratio === null ? 35 : ratio * 100}%`, backgroundColor: theme.palette.primary }]} />
      : <Animated.View testID={`song-preparation-progress-fill-${id}`} style={[styles.fill, { width: indeterminate ? '35%' : '100%',
        backgroundColor: theme.palette.primary, transform: [{ translateX }] }]} />}
  </View>;
};

const WaveformProgress = ({ song, id }: { song: Song; id: string }) => {
  const { sourceFingerprint } = getWaveformSourceIdentity(song);
  const subscribe = useCallback((listener: () => void) => subscribeWaveformStatus(sourceFingerprint, listener), [sourceFingerprint]);
  const snapshot = useCallback(() => getWaveformProgress(sourceFingerprint), [sourceFingerprint]);
  const ratio = useSyncExternalStore(subscribe, snapshot, snapshot);
  return <ProcessingRail id={id} label={`Wellenform wird vorbereitet · ${song.title}`} ratio={ratio} />;
};

const SongPreparationProgress = memo(({ song, status, id = song.id }: {
  song: Song; status: WaveformStatus; id?: string;
}) => {
  const uri = song.uri?.trim() ?? '';
  const fileUri = song.fileInfo?.uri?.trim() ?? '';
  const subscribe = useCallback((listener: () => void) => {
    const remove = uri ? subscribeSongProcessing(uri, listener) : undefined;
    const removeFile = fileUri && fileUri !== uri ? subscribeSongProcessing(fileUri, listener) : undefined;
    return () => { remove?.(); removeFile?.(); };
  }, [uri, fileUri]);
  const snapshot = useCallback(() => getSongProcessingPhase(uri) ?? getSongProcessingPhase(fileUri), [uri, fileUri]);
  const phase = useSyncExternalStore(subscribe, snapshot, snapshot);
  if (phase) return <ProcessingRail id={id} label={`${phaseLabels[phase]} · ${song.title}`} ratio={null} />;
  return status === 'analyzing' ? <WaveformProgress song={song} id={id} /> : null;
});

const styles = StyleSheet.create({
  track: { position: 'absolute', left: 3, right: 3, bottom: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2, opacity: 0.72 },
  indeterminateStatic: { alignSelf: 'center' },
});

export default SongPreparationProgress;
