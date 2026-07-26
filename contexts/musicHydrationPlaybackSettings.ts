import { EQ_BAND_COUNT } from '../types/Song';
import { applyRepeatModeToTrackPlayer, applyVolumeToTrackPlayer } from './playbackControlHelpers';
import { sanitizeStoredPlaylistsForHydration } from './musicHydrationPlan';
import { persistSanitizedPlaylistsInBackground } from './musicHydrationPersistence';
import type { ApplyStoredPlaybackSettingsArgs } from './musicHydrationTypes';

export const applyStoredPlaybackSettings = async ({
  stored,
  setPlaylists,
  setEqEnabledState,
  setEqBandsState,
  setEqPreset,
  setVolumeState,
  setRepeatMode,
  setShuffle,
  isCancelled = () => false,
  skipShuffle = false,
}: ApplyStoredPlaybackSettingsArgs & { isCancelled?: () => boolean; skipShuffle?: boolean }): Promise<void> => {
  const nativeWrites: Promise<unknown>[] = [];
  if (stored.volume != null) nativeWrites.push(applyVolumeToTrackPlayer(stored.volume));
  if (stored.repeatMode != null) nativeWrites.push(applyRepeatModeToTrackPlayer(stored.repeatMode));

  // Do not expose the provider as ready while older native writes are still in
  // flight. A failure is allowed to reach the hydration fallback instead of
  // being hidden in a detached .catch handler.
  await Promise.all(nativeWrites);
  if (isCancelled()) return;

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
  if (stored.volume != null) setVolumeState(stored.volume);
  if (stored.repeatMode != null) setRepeatMode(stored.repeatMode);
  if (!skipShuffle && stored.shuffle != null) setShuffle(stored.shuffle);
};
