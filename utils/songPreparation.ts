import type { Song } from '../types/Song';
import { getCompatibleWaveformSourceIdentities } from './waveformGenerator';
import { getWaveformStatus, type WaveformStatus } from './waveformStatus';
import { wasSongPrepared } from './songPreparationStore';
import { getCachedWaveformAvailability } from './waveformCache';

export interface SongAnalysisState {
  analysisCompleted: boolean;
  waveformAvailable: boolean;
  bassAvailable: boolean;
}

/** History is distinct from live availability; neither controls audio playback. */
export const getSongAnalysisState = (song: Song): SongAnalysisState => {
  const identities = getCompatibleWaveformSourceIdentities(song);
  const availability = identities.map(getCachedWaveformAvailability);
  return {
    analysisCompleted: availability.some(value => value.waveformAvailable)
      || identities.some(identity => wasSongPrepared(identity.sourceFingerprint)),
    waveformAvailable: availability.some(value => value.waveformAvailable),
    bassAvailable: availability.some(value => value.bassAvailable),
  };
};

export const getSongPreparationStatus = (song: Song): WaveformStatus => {
  const identities = getCompatibleWaveformSourceIdentities(song);
  const { sourceFingerprint } = identities[0];
  const status = getWaveformStatus(sourceFingerprint);
  return identities.some(identity => getWaveformStatus(identity.sourceFingerprint) === 'ready') ? 'ready' : status;
};

export const isSongPrepared = (song: Song): boolean => getSongPreparationStatus(song) === 'ready';
export const getPreparedSongs = (songs: Song[]): Song[] => songs.filter(isSongPrepared);
