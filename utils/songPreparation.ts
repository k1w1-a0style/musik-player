import type { Song } from '../types/Song';
import { getCompatibleWaveformSourceIdentities } from './waveformGenerator';
import { getWaveformStatus, type WaveformStatus } from './waveformStatus';
import { wasSongPrepared } from './songPreparationStore';

export const getSongPreparationStatus = (song: Song): WaveformStatus => {
  const identities = getCompatibleWaveformSourceIdentities(song);
  const { sourceFingerprint } = identities[0];
  const status = getWaveformStatus(sourceFingerprint);
  if (status === 'unavailable') return status;
  return identities.some(identity => wasSongPrepared(identity.sourceFingerprint)) ? 'ready' : status;
};

export const isSongPrepared = (song: Song): boolean => getSongPreparationStatus(song) === 'ready';
export const getPreparedSongs = (songs: Song[]): Song[] => songs.filter(isSongPrepared);
