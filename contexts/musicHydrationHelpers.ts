import type { Song } from '../types/Song';
import { sanitizeSongsForStorage } from '../utils/coverCache';
import { cleanupCoverCache } from '../utils/coverCacheCleanup';
import {
  applyHydratedCurrentSongState,
  applyHydratedQueueState,
  applyHydratedSongsState,
} from './musicHydrationApplyState';
import { applyHydrationFailureFallback } from './musicHydrationFallback';
import { loadStoredMusicHydrationState } from './musicHydrationLoad';
import {
  applyHydrationPlanToStoredState,
  createHydrationPlan,
} from './musicHydrationPlan';
import {
  applyHydratedNativeQueue,
  clearNativeQueueAfterMalformedRestoredSong,
} from './musicHydrationNativeQueue';
import { applyStoredPlaybackSettings } from './musicHydrationPlaybackSettings';
import {
  persistHydratedCurrentSongIdIfNeeded,
  persistHydratedPlaylistsIfNeeded,
  persistHydratedSongsIfNeeded,
} from './musicHydrationPersistence';
import { setupTrackPlayer } from '../utils/trackPlayerSetup';
import {
  acquireSongCoverProtection,
  type SongCoverProtectionLease,
} from './songCoverProtectionLifecycle';
import type {
  HydrateStoredSongsArgs,
  RunMusicHydrationArgs,
  StoredMusicHydrationState,
} from './musicHydrationTypes';

const cleanupHydratedSongCovers = async (songs: Song[]): Promise<void> => {
  try {
    await cleanupCoverCache(songs);
  } catch (error) {
    console.warn('[MusicHydration] Failed to clean up hydrated cover cache.', error);
  }
};

const handoffUnconfirmedHydratedSongProtection = (
  coverLease: SongCoverProtectionLease,
  hydratedSongs: Song[],
  error?: unknown,
): void => {
  coverLease.handoffFromHydration(hydratedSongs);
  console.warn('[MusicHydration] Failed to confirm sanitized songs persistence.', error);
};

export type {
  HydrateStoredSongsArgs,
  RunMusicHydrationArgs,
  StoredMusicHydrationState,
} from './musicHydrationTypes';
export { loadStoredMusicHydrationState } from './musicHydrationLoad';
export { createHydrationPlan, sanitizeStoredPlaylistsForHydration } from './musicHydrationPlan';
export { applyStoredPlaybackSettings } from './musicHydrationPlaybackSettings';

export const hydrateStoredSongs = async ({
  stored,
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  setSongsState,
  setCurrentSong,
  setPlaybackQueue,
  isCancelled,
}: HydrateStoredSongsArgs): Promise<StoredMusicHydrationState> => {
  if (!stored.songs) return stored;

  const coverLease = acquireSongCoverProtection(stored.songs);
  try {
    const sanitizedSongs = await sanitizeSongsForStorage(stored.songs, coverLease.protection);
    if (isCancelled()) return stored;

    coverLease.updateSnapshot(sanitizedSongs);
    const plan = createHydrationPlan(stored, sanitizedSongs);

    applyHydratedSongsState(plan, { songsRef, setSongsState });

    const songsPersistResult = await persistHydratedSongsIfNeeded(plan);
    if (songsPersistResult.status === 'unconfirmed') {
      handoffUnconfirmedHydratedSongProtection(coverLease, plan.hydratedSongs, songsPersistResult.error);
    } else {
      coverLease.prepareConfirmedCleanup(plan.hydratedSongs);
      await cleanupHydratedSongCovers(plan.hydratedSongs);
      coverLease.markConfirmedAfterCleanup();
    }
    if (isCancelled()) return stored;

    applyHydratedQueueState(plan, { queueContextRef, baseQueueContextRef, setPlaybackQueue });

    await persistHydratedPlaylistsIfNeeded(plan);
    if (isCancelled()) return stored;

    applyHydratedCurrentSongState(plan, { setCurrentSong });

    await persistHydratedCurrentSongIdIfNeeded(plan);
    if (isCancelled()) return stored;

    const hydratedStored = applyHydrationPlanToStoredState(stored, plan);

    if (plan.nativeQueueAction === 'clearMalformedCurrent') {
      await clearNativeQueueAfterMalformedRestoredSong(nativeQueueRef);
      return hydratedStored;
    }

    await applyHydratedNativeQueue({ plan, nativeQueueRef, isCancelled });

    return hydratedStored;
  } finally {
    coverLease.releaseCurrentOwner();
  }
};

export const runMusicHydration = async ({
  setIsReady,
  isCancelled,
  ...args
}: RunMusicHydrationArgs): Promise<void> => {
  let hydrationCompleted = false;
  try {
    await setupTrackPlayer();
    if (isCancelled()) return;

    const stored = await loadStoredMusicHydrationState().catch(error => {
      console.warn('[MusicHydration:StorageError] Failed to load stored hydration state.', error);
      throw error;
    });

    if (isCancelled()) return;

    const hydratedStored = await hydrateStoredSongs({ stored, isCancelled, ...args }).catch(error => {
      console.warn('[MusicHydration:SanitizeError] Failed while hydrating stored songs.', error);
      throw error;
    });

    if (isCancelled()) return;

    try {
      applyStoredPlaybackSettings({ stored: hydratedStored, ...args });
      hydrationCompleted = true;
    } catch (error) {
      console.warn('[MusicHydration:TrackPlayerError] Failed to apply stored playback settings.', error);
      throw error;
    }
  } catch (error) {
    if (isCancelled()) return;

    await applyHydrationFailureFallback(args, error);
    hydrationCompleted = true;
  } finally {
    if (!isCancelled() && hydrationCompleted) setIsReady(true);
  }
};
