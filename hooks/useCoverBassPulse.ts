import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useProgress } from 'react-native-track-player';
import type { Song } from '../types/Song';
import { getCoverBassScale, hasBassEnvelope } from '../utils/coverBassPulse';
import { useCoverBassEnvelope } from './useCoverBassEnvelope';

/** Mounted only for the enabled, current classic cover. No updates to the library. */
export const useCoverBassPulse = (song: Song | null | undefined, isPlaying: boolean) => {
  const progress = useProgress(500);
  const waveform = useCoverBassEnvelope(song, isPlaying);
  const playhead = useRef(new Animated.Value(0)).current;
  const enabled = useRef(new Animated.Value(0)).current;
  const curve = useMemo(() => {
    if (!hasBassEnvelope(waveform)) return playhead.interpolate<number>({ inputRange: [0, 1], outputRange: [0, 0] });
    const step = waveform.durationMs / waveform.bassPoints.length;
    const inputRange = waveform.bassPoints.map((_, index) => index * step);
    const outputRange = waveform.bassPoints.map((_, index) =>
      getCoverBassScale(waveform.bassPoints, waveform.durationMs, (index + 0.5) * step) - 1);
    inputRange.push(waveform.durationMs);
    outputRange.push(0);
    return playhead.interpolate<number>({ inputRange, outputRange, extrapolate: 'clamp' });
  }, [playhead, waveform]);
  const scale = useMemo(() => Animated.add(1, Animated.multiply(enabled, curve)), [curve, enabled]);

  useEffect(() => {
    playhead.stopAnimation();
    enabled.setValue(isPlaying && hasBassEnvelope(waveform) ? 1 : 0);
    if (!isPlaying || !hasBassEnvelope(waveform)) return;
    const positionMs = Math.max(0, Math.min(waveform.durationMs, progress.position * 1000));
    playhead.setValue(positionMs);
    // All 50 ms bass buckets are interpolated on the UI thread. There is no
    // bridge callback between beats, even while the JS thread is doing I/O.
    const target = Math.min(waveform.durationMs, positionMs + 750);
    const animation = Animated.timing(playhead, { toValue: target,
      duration: target - positionMs, easing: Easing.linear, useNativeDriver: true, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [enabled, isPlaying, playhead, progress.position, waveform]);
  useEffect(() => () => { playhead.stopAnimation(); enabled.setValue(0); }, [enabled, playhead]);
  return scale;
};
