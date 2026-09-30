import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { Song } from '../types/Song';
import { getCachedWaveformForSong } from '../utils/waveformSourceCache';
import { getWaveformSourceIdentity } from '../utils/waveformGenerator';
import { getWaveformStatus, subscribeWaveformStatus } from '../utils/waveformStatus';

/** Reads persisted readiness without starting a decoder for each visible row. */
export const useWaveformStatus = (song: Song) => {
  const songRef = useRef(song);
  songRef.current = song;
  const { sourceKey, sourceFingerprint } = getWaveformSourceIdentity(song);
  const subscribe = useCallback((listener: () => void) =>
    subscribeWaveformStatus(sourceFingerprint, listener), [sourceFingerprint]);
  const snapshot = useCallback(() => getWaveformStatus(sourceFingerprint), [sourceFingerprint]);
  const status = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    void getCachedWaveformForSong(songRef.current).catch(() => undefined);
  }, [sourceFingerprint, sourceKey]);
  return status;
};
