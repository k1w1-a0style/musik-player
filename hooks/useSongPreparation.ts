import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { Song } from '../types/Song';
import { getWaveformSourceIdentity } from '../utils/waveformGenerator';
import { loadPreparedSources, markSongPrepared, subscribeSongPreparation, wasSongPrepared } from '../utils/songPreparationStore';
import { useWaveformStatus } from './useWaveformStatus';

export const useSongPreparation = (song: Song) => {
  const waveformStatus = useWaveformStatus(song);
  const { sourceFingerprint } = getWaveformSourceIdentity(song);
  const subscribe = useCallback((listener: () => void) =>
    subscribeSongPreparation(sourceFingerprint, listener), [sourceFingerprint]);
  const snapshot = useCallback(() => wasSongPrepared(sourceFingerprint), [sourceFingerprint]);
  const prepared = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => { void loadPreparedSources().catch(() => undefined); }, []);
  useEffect(() => {
    if (waveformStatus === 'ready') void markSongPrepared(sourceFingerprint).catch(() => undefined);
  }, [sourceFingerprint, waveformStatus]);
  if (waveformStatus === 'unavailable') return waveformStatus;
  return prepared ? 'ready' : waveformStatus;
};
