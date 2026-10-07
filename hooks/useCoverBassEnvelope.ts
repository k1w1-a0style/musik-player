import { useEffect, useRef, useState } from 'react';
import type { Song } from '../types/Song';
import { getWaveformSourceIdentity } from '../utils/waveformGenerator';
import { getCachedWaveformForSong } from '../utils/waveformSourceCache';
import { setCachedWaveform } from '../utils/waveformCache';
import { extractNativeWaveform } from '../utils/waveformExtraction';
import { getWaveformStatus, setWaveformStatus, subscribeWaveformStatus } from '../utils/waveformStatus';
import { MAX_WAVEFORM_CONTENTION_RETRIES, waitForWaveformSchedulerAvailability,
  WAVEFORM_SCHEDULER_WAIT_TIMEOUT_MS } from '../utils/waveformExtractionLifecycle';
import { hasBassEnvelope } from '../utils/coverBassPulse';
import type { SongWaveform } from '../utils/waveformTypes';
import { logCoverBassEnvelope } from '../utils/waveformTelemetry';

/** Upgrade an older cache only for the audible classic track, never its neighbours. */
export const useCoverBassEnvelope = (song: Song | null | undefined, isPlaying: boolean) => {
  const fingerprint = getWaveformSourceIdentity(song).sourceFingerprint;
  const songRef = useRef(song);
  songRef.current = song;
  const [resolved, setResolved] = useState<SongWaveform | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const selected = songRef.current;
    if (!selected) return;
    let waveformAvailable = false;
    const readPublishedBass = async () => {
      const cached = await getCachedWaveformForSong(selected);
      waveformAvailable = cached?.source === 'native';
      if (!controller.signal.aborted && hasBassEnvelope(cached)) setResolved(cached);
      return cached;
    };
    const unsubscribe = subscribeWaveformStatus(fingerprint, () => {
      if (getWaveformStatus(fingerprint) === 'ready') void readPublishedBass().catch(() => undefined);
    });
    const restoreReadiness = () => {
      if (!controller.signal.aborted && waveformAvailable) setWaveformStatus(fingerprint, 'ready');
    };
    const load = async () => {
      const cached = await readPublishedBass();
      if (controller.signal.aborted) return;
      logCoverBassEnvelope('cache', cached);
      if (hasBassEnvelope(cached)) { setResolved(cached); return; }
      if (!isPlaying) return;
      // The audible track must not be preempted by speculative/library scans.
      const deadline = Date.now() + WAVEFORM_SCHEDULER_WAIT_TIMEOUT_MS;
      for (let attempt = 0; attempt < MAX_WAVEFORM_CONTENTION_RETRIES; attempt += 1) {
        let deferred = false;
        const decoded = await extractNativeWaveform(selected, selected.duration ?? selected.audioInfo?.durationMs ?? 0, {
          signal: controller.signal, priority: 'foreground',
          onDecision: ({ decision }) => { deferred = decision === 'native-scheduler-preempted'
            || decision === 'native-scheduler-unavailable'; },
        });
        if (controller.signal.aborted) return;
        logCoverBassEnvelope('native', decoded);
        if (hasBassEnvelope(decoded)) {
          setResolved(decoded); waveformAvailable = true;
          await setCachedWaveform(decoded);
          return;
        }
        restoreReadiness();
        if (!deferred || Date.now() >= deadline) return;
        await waitForWaveformSchedulerAvailability(controller.signal, 'foreground', deadline - Date.now());
        const published = await readPublishedBass();
        if (hasBassEnvelope(published)) return;
      }
    };
    void load().catch(restoreReadiness);
    return () => {
      unsubscribe();
      controller.abort();
      // Cancelling the optional bass upgrade must not lock an already prepared
      // track after its shared decoder resets the analysis status to pending.
      if (waveformAvailable) setWaveformStatus(fingerprint, 'ready');
    };
  }, [fingerprint, isPlaying]);

  return resolved?.sourceFingerprint === fingerprint ? resolved : null;
};
