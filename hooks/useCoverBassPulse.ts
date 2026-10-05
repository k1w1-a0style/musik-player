import { useEffect } from 'react';
import { Animated, Easing } from 'react-native';
import { useProgress } from 'react-native-track-player';
import type { Song } from '../types/Song';
import { BASS_PULSE_STEP_MS, getCoverBassScale, hasBassEnvelope } from '../utils/coverBassPulse';
import { useCoverBassEnvelope } from './useCoverBassEnvelope';

/** Mounted only for the enabled, current classic cover. No updates to the library. */
export const useCoverBassPulse = (song: Song | null | undefined, isPlaying: boolean, scale: Animated.Value) => {
  const progress = useProgress(isPlaying ? 250 : 500);
  const waveform = useCoverBassEnvelope(song, isPlaying);

  useEffect(() => {
    scale.stopAnimation();
    if (!isPlaying || !hasBassEnvelope(waveform)) { scale.setValue(1); return; }
    const positionMs = progress.position * 1000;
    // Keep native frames ahead of the playback clock between progress samples.
    const animation = Animated.sequence(Array.from({ length: 8 }, (_, index) => Animated.timing(scale, {
      toValue: getCoverBassScale(waveform.bassPoints, waveform.durationMs, positionMs + (index + 1) * BASS_PULSE_STEP_MS),
      duration: BASS_PULSE_STEP_MS, easing: Easing.linear, useNativeDriver: true, isInteraction: false,
    })));
    animation.start();
    return () => animation.stop();
  }, [isPlaying, progress.position, scale, waveform]);
  useEffect(() => () => { scale.stopAnimation(); scale.setValue(1); }, [scale]);
  return scale;
};
