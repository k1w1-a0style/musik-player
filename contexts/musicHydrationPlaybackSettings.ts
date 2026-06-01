import TrackPlayer from 'react-native-track-player';
import { EQ_BAND_COUNT } from '../types/Song';
import { toTrackPlayerRepeatMode } from '../utils/audioPlaybackModes';
import { sanitizeStoredPlaylistsForHydration } from './musicHydrationPlan';
import { persistSanitizedPlaylistsInBackground } from './musicHydrationPersistence';
import type { ApplyStoredPlaybackSettingsArgs } from './musicHydrationTypes';

export const applyStoredPlaybackSettings = ({
  stored,
  setPlaylists,
  setEqEnabledState,
  setEqBandsState,
  setEqPreset,
  setVolumeState,
  setRepeatMode,
  setShuffle,
}: ApplyStoredPlaybackSettingsArgs): void => {
  const sanitizedPlaylists = sanitizeStoredPlaylistsForHydration(stored);
  if (sanitizedPlaylists) {
    setPlaylists(sanitizedPlaylists);
    if (sanitizedPlaylists !== stored.playlists) {
      persistSanitizedPlaylistsInBackground(sanitizedPlaylists);
    }
  }
  if (stored.eqEnabled != null) setEqEnabledState(stored.eqEnabled);
  if (stored.eqBands?.length === EQ_BAND_COUNT) setEqBandsState(stored.eqBands);
  if (stored.eqPreset != null) setEqPreset(stored.eqPreset);
  if (stored.volume != null) {
    setVolumeState(stored.volume);
    TrackPlayer.setVolume(stored.volume).catch(error => {
      console.warn('[Playback] Failed to apply stored volume.', error);
    });
  }
  if (stored.repeatMode != null) {
    setRepeatMode(stored.repeatMode);
    TrackPlayer.setRepeatMode(toTrackPlayerRepeatMode(stored.repeatMode)).catch(error => {
      console.warn('[Playback] Failed to apply stored repeat mode.', error);
    });
  }
  if (stored.shuffle != null) setShuffle(stored.shuffle);
};
