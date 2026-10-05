import { useEffect, useRef, useState } from 'react';
import type { Song } from '../types/Song';
import { getWaveformSourceIdentity } from '../utils/waveformGenerator';
import { getCachedWaveformForSong } from '../utils/waveformSourceCache';
import { setCachedWaveform } from '../utils/waveformCache';
import { extractNativeWaveform } from '../utils/waveformExtraction';
import { getWaveformStatus, setWaveformStatus, subscribeWaveformStatus } from '../utils/waveformStatus';
import { isSongPrepared } from '../utils/songPreparation';
import { hasBassEnvelope } from '../utils/coverBassPulse';
import type { SongWaveform } from '../utils/waveformTypes';

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
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const readPublishedBass = async () => {
      const cached = await getCachedWaveformForSong(selected);
      if (!controller.signal.aborted && hasBassEnvelope(cached)) setResolved(cached);
      return cached;
    };
    const unsubscribe = subscribeWaveformStatus(fingerprint, () => {
      if (getWaveformStatus(fingerprint) === 'ready') void readPublishedBass().catch(() => undefined);
    });
    const prepared = isSongPrepared(selected);
    const restoreReadiness = () => {
      if (!controller.signal.aborted && prepared) setWaveformStatus(fingerprint, 'ready');
    };
    const load = async () => {
      const cached = await readPublishedBass();
      if (controller.signal.aborted) return;
      if (hasBassEnvelope(cached)) { setResolved(cached); return; }
      if (!isPlaying) return;
      // The audible track must not be preempted by speculative/library scans.
      let deferred = false;
      const decoded = await extractNativeWaveform(selected, selected.duration ?? selected.audioInfo?.durationMs ?? 0, {
        signal: controller.signal, priority: 'foreground',
        onDecision: ({ decision }) => { deferred = decision === 'native-scheduler-preempted'
          || decision === 'native-scheduler-unavailable'; },
      });
      if (controller.signal.aborted) return;
      if (hasBassEnvelope(decoded)) {
        setResolved(decoded);
        await setCachedWaveform(decoded);
      } else {
        restoreReadiness();
        if (deferred) retryTimer = setTimeout(() => { void load().catch(restoreReadiness); }, 500);
      }
    };
    void load().catch(restoreReadiness);
    return () => {
      unsubscribe();
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
      // Cancelling the optional bass upgrade must not lock an already prepared
      // track after its shared decoder resets the analysis status to pending.
      if (prepared) setWaveformStatus(fingerprint, 'ready');
    };
  }, [fingerprint, isPlaying]);

  return resolved?.sourceFingerprint === fingerprint ? resolved : null;
};
