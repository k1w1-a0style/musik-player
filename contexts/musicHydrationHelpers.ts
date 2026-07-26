import type { Song } from '../types/Song';
import { sanitizeSongsForStorage } from '../utils/coverCache';
import { cleanupCoverCache } from '../utils/coverCacheCleanup';
import {
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
  type HydratedNativeQueueResult,
} from './musicHydrationNativeQueue';
import { applyStoredPlaybackSettings } from './musicHydrationPlaybackSettings';
import {
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

export type HydrateStoredSongsResult = StoredMusicHydrationState & HydratedNativeQueueResult;

const withoutNativeMutation = (
  stored: StoredMusicHydrationState,
  refs: Pick<HydrateStoredSongsArgs, 'nativeQueueRef' | 'queueContextRef' | 'baseQueueContextRef'>,
): HydrateStoredSongsResult => ({
  ...stored,
  nativeStatus: 'stale',
  verifiedState: null,
  lastKnownUnverifiedState: {
    nativeQueueRef: refs.nativeQueueRef.current.slice(),
    logicalQueue: refs.queueContextRef.current.slice(),
    baseQueue: refs.baseQueueContextRef.current.slice(),
  },
  currentSongPersistence: { status: 'not-required' },
  failureStage: 'snapshot',
});

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
}: HydrateStoredSongsArgs): Promise<HydrateStoredSongsResult> => {
  const refs = { nativeQueueRef, queueContextRef, baseQueueContextRef };
  if (!stored.songs) return withoutNativeMutation(stored, refs);

  const coverLease = acquireSongCoverProtection(stored.songs);
  try {
    const sanitizedSongs = await sanitizeSongsForStorage(stored.songs, coverLease.protection);
    if (isCancelled()) return withoutNativeMutation(stored, refs);

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
    if (isCancelled()) return withoutNativeMutation(stored, refs);

    await persistHydratedPlaylistsIfNeeded(plan);
    if (isCancelled()) return withoutNativeMutation(stored, refs);

    const hydratedStored = applyHydrationPlanToStoredState(stored, plan);

    const nativeResult = await applyHydratedNativeQueue({
      plan,
      nativeQueueRef,
      isCancelled,
      librarySongs: plan.hydratedSongs,
      shuffleEnabled: stored.shuffle ?? false,
      targets: { nativeQueueRef, queueContextRef, baseQueueContextRef, setPlaybackQueue, setCurrentSong },
    });
    if (nativeResult.verifiedState === null) return { ...hydratedStored, ...nativeResult };
    const persistedCurrentSongId = nativeResult.currentSongPersistence.status === 'set-confirmed'
      ? nativeResult.activeSong?.id ?? null
      : nativeResult.currentSongPersistence.status === 'remove-confirmed' ? null : stored.currentSongId;
    return { ...hydratedStored, ...nativeResult, currentSongId: persistedCurrentSongId };
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
      await applyStoredPlaybackSettings({ stored: hydratedStored, isCancelled, ...args });
      hydrationCompleted = true;
    } catch (error) {
      console.warn('[MusicHydration:TrackPlayerError] Failed to apply stored playback settings.', error);
      throw error;
    }
  } catch (error) {
    if (isCancelled()) return;

    const fallback = await applyHydrationFailureFallback(args, error);
    hydrationCompleted = fallback.status === 'applied';
  } finally {
    if (!isCancelled() && hydrationCompleted) setIsReady(true);
  }
};
