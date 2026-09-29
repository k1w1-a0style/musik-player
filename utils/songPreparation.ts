import type { Song } from '../types/Song';
import { getWaveformSourceIdentity } from './waveformGenerator';
import { getWaveformStatus, type WaveformStatus } from './waveformStatus';
import { wasSongPrepared } from './songPreparationStore';

export const getSongPreparationStatus = (song: Song): WaveformStatus => {
  const { sourceFingerprint } = getWaveformSourceIdentity(song);
  const status = getWaveformStatus(sourceFingerprint);
  if (status === 'unavailable') return status;
  return wasSongPrepared(sourceFingerprint) ? 'ready' : status;
};

export const isSongPrepared = (song: Song): boolean => getSongPreparationStatus(song) === 'ready';
export const getPreparedSongs = (songs: Song[]): Song[] => songs.filter(isSongPrepared);
