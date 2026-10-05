import { useEffect, useRef, useState } from 'react';
import type { Song } from '../types/Song';
import { getWaveformSourceIdentity } from '../utils/waveformGenerator';
import { getCachedWaveformForSong } from '../utils/waveformSourceCache';
import { setCachedWaveform } from '../utils/waveformCache';
import { extractNativeWaveform } from '../utils/waveformExtraction';
import { setWaveformStatus } from '../utils/waveformStatus';
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
    const prepared = isSongPrepared(selected);
    const restoreReadiness = () => {
      if (!controller.signal.aborted && prepared) setWaveformStatus(fingerprint, 'ready');
    };
    void (async () => {
      const cached = await getCachedWaveformForSong(selected);
      if (controller.signal.aborted) return;
      if (hasBassEnvelope(cached)) { setResolved(cached); return; }
      if (!isPlaying) return;
      // The audible track must not be preempted by speculative/library scans.
      const decoded = await extractNativeWaveform(selected, selected.duration ?? 0, {
        signal: controller.signal, priority: 'foreground',
      });
      if (controller.signal.aborted) return;
      if (hasBassEnvelope(decoded)) {
        setResolved(decoded);
        await setCachedWaveform(decoded);
      } else restoreReadiness();
    })().catch(restoreReadiness);
    return () => { controller.abort(); };
  }, [fingerprint, isPlaying]);

  return resolved?.sourceFingerprint === fingerprint ? resolved : null;
};
