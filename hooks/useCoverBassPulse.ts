import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useProgress } from 'react-native-track-player';
import type { Song } from '../types/Song';
import { getWaveformSourceIdentity } from '../utils/waveformGenerator';
import { getCachedWaveformForSong } from '../utils/waveformSourceCache';
import { setCachedWaveform } from '../utils/waveformCache';
import { extractNativeWaveform } from '../utils/waveformExtraction';
import { setWaveformStatus } from '../utils/waveformStatus';
import { isSongPrepared } from '../utils/songPreparation';
import { BASS_PULSE_STEP_MS, getCoverBassScale, hasBassEnvelope } from '../utils/coverBassPulse';
import type { SongWaveform } from '../utils/waveformTypes';

/** Mounted only for the enabled, current classic cover. No updates to the library. */
export const useCoverBassPulse = (song: Song | null | undefined, isPlaying: boolean, scale: Animated.Value) => {
  const progress = useProgress(isPlaying ? 100 : 500);
  const fingerprint = getWaveformSourceIdentity(song).sourceFingerprint;
  const songRef = useRef(song);
  songRef.current = song;
  const [resolved, setResolved] = useState<SongWaveform | null>(null);
  const waveform = resolved?.sourceFingerprint === fingerprint ? resolved : null;

  useEffect(() => {
    const controller = new AbortController();
    const selected = songRef.current;
    if (!selected) return;
    const prepared = isSongPrepared(selected);
    void (async () => {
      const cached = await getCachedWaveformForSong(selected);
      if (controller.signal.aborted) return;
      if (hasBassEnvelope(cached)) { setResolved(cached); return; }
      // Upgrade only this old cached track when the option is used. Existing
      // preparation/waveform identities remain valid; no whole-library rescan.
      const decoded = await extractNativeWaveform(selected, selected.duration ?? 0, {
        signal: controller.signal, priority: 'background',
      });
      if (controller.signal.aborted) return;
      if (hasBassEnvelope(decoded)) {
        setResolved(decoded);
        await setCachedWaveform(decoded);
      } else if (prepared) setWaveformStatus(fingerprint, 'ready');
    })().catch(() => {
      if (!controller.signal.aborted && prepared) setWaveformStatus(fingerprint, 'ready');
    });
    return () => { controller.abort(); };
  }, [fingerprint]);

  useEffect(() => {
    scale.stopAnimation();
    if (!isPlaying || !hasBassEnvelope(waveform)) { scale.setValue(1); return; }
    const positionMs = progress.position * 1000;
    const animation = Animated.sequence(Array.from({ length: 6 }, (_, index) => Animated.timing(scale, {
      toValue: getCoverBassScale(waveform.bassPoints, waveform.durationMs, positionMs + index * BASS_PULSE_STEP_MS),
      duration: BASS_PULSE_STEP_MS, easing: Easing.linear, useNativeDriver: true, isInteraction: false,
    })));
    animation.start();
    return () => animation.stop();
  }, [isPlaying, progress.position, scale, waveform]);
  useEffect(() => () => { scale.stopAnimation(); scale.setValue(1); }, [scale]);
  return scale;
};
