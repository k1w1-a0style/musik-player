import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Song } from '../types/Song';
import { getCompatibleWaveformSourceIdentities } from '../utils/waveformGenerator';
import { loadPreparedSources, markSongPrepared, subscribeSongPreparation, wasSongPrepared } from '../utils/songPreparationStore';
import { useWaveformStatus } from './useWaveformStatus';

export const useSongPreparation = (song: Song) => {
  const waveformStatus = useWaveformStatus(song);
  const fingerprints = useMemo(() => getCompatibleWaveformSourceIdentities(song)
    .map(identity => identity.sourceFingerprint), [song]);
  const sourceFingerprint = fingerprints[0];
  const subscribe = useCallback((listener: () => void) => {
    const cleanups = fingerprints.map(fingerprint => subscribeSongPreparation(fingerprint, listener));
    return () => cleanups.forEach(cleanup => cleanup());
  }, [fingerprints]);
  const snapshot = useCallback(() => fingerprints.some(wasSongPrepared), [fingerprints]);
  const prepared = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => { void loadPreparedSources().catch(() => undefined); }, []);
  useEffect(() => {
    if (prepared || waveformStatus === 'ready') void markSongPrepared(sourceFingerprint).catch(() => undefined);
  }, [prepared, sourceFingerprint, waveformStatus]);
  if (waveformStatus === 'unavailable') return waveformStatus;
  return prepared ? 'ready' : waveformStatus;
};
