import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { Song } from '../types/Song';
import { getCachedWaveform } from '../utils/waveformCache';
import { getWaveformSourceIdentity } from '../utils/waveformGenerator';
import { getWaveformStatus, subscribeWaveformStatus } from '../utils/waveformStatus';

/** Reads persisted readiness without starting a decoder for each visible row. */
export const useWaveformStatus = (song: Song) => {
  const { sourceKey, sourceFingerprint } = getWaveformSourceIdentity(song);
  const subscribe = useCallback((listener: () => void) =>
    subscribeWaveformStatus(sourceFingerprint, listener), [sourceFingerprint]);
  const snapshot = useCallback(() => getWaveformStatus(sourceFingerprint), [sourceFingerprint]);
  const status = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    void getCachedWaveform({ sourceKey, sourceFingerprint }).catch(() => undefined);
  }, [sourceFingerprint, sourceKey]);
  return status;
};
