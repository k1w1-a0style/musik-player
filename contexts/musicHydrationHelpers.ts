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
  clearNativeQueueAfterMalformedRestoredSong,
  type HydratedNativeQueueResult,
} from './musicHydrationNativeQueue';
import { applyStoredPlaybackSettings } from './musicHydrationPlaybackSettings';
import {
  persistHydratedPlaylistsIfNeeded,
  persistHydratedSongsIfNeeded,
} from './musicHydrationPersistence';
import { setupTrackPlayer } from '../utils/trackPlayerSetup';
import { StorageKeys, storage } from '../utils/storage';
import {
  acquireSongCoverProtection,
  type SongCoverProtectionLease,
} from './songCoverProtectionLifecycle';
import type {
  HydrateStoredSongsArgs,
  RunMusicHydrationArgs,
  StoredMusicHydrationState,
} from './musicHydrationTypes';
import type { HydrationPlan } from './musicHydrationPlan';

const commitHydratedNativeResult = async (
  plan: HydrationPlan,
  nativeResult: Exclude<HydratedNativeQueueResult, { status: 'failed' }>,
  stored: StoredMusicHydrationState,
  targets: Pick<HydrateStoredSongsArgs, 'nativeQueueRef' | 'queueContextRef' | 'baseQueueContextRef' | 'setPlaybackQueue' | 'setCurrentSong'>,
): Promise<StoredMusicHydrationState> => {
  const leavesNativeQueueUntouched = plan.nativeQueueAction === 'none';
  const confirmedQueue = leavesNativeQueueUntouched ? plan.playableQueue.slice() : nativeResult.queue.slice();
  if (!leavesNativeQueueUntouched) targets.nativeQueueRef.current = confirmedQueue.slice();
  targets.queueContextRef.current = confirmedQueue.slice();
  const planIds = new Set(plan.hydratedQueue.map(song => song.id));
  const confirmedBase = plan.hydratedQueue.length === confirmedQueue.length
    && confirmedQueue.every(song => planIds.has(song.id)) ? plan.hydratedQueue : confirmedQueue;
  targets.baseQueueContextRef.current = confirmedBase.slice();
  targets.setPlaybackQueue(confirmedQueue.slice());
  const activeSong = leavesNativeQueueUntouched ? plan.restoredSong ?? null : nativeResult.activeSong;
  targets.setCurrentSong(activeSong);
  const confirmedId = activeSong?.id ?? null;
  try {
    if (confirmedId !== stored.currentSongId) {
      const persisted = confirmedId
        ? await storage.set(StorageKeys.CURRENT_SONG_ID, confirmedId)
        : await (storage.remove(StorageKeys.CURRENT_SONG_ID) as Promise<unknown>);
      if (persisted === false) throw new Error('Hydrated current-song persistence was not confirmed.');
    }
  } catch (error) {
    nativeResult.persistenceError = error;
    console.warn('[MusicHydration] Native queue recovered but current-song persistence failed.', error);
  }
  return { ...applyHydrationPlanToStoredState(stored, plan), currentSongId: confirmedId };
};

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

    await persistHydratedPlaylistsIfNeeded(plan);
    if (isCancelled()) return stored;

    const hydratedStored = applyHydrationPlanToStoredState(stored, plan);

    const nativeResult = plan.nativeQueueAction === 'clearMalformedCurrent'
      ? (await clearNativeQueueAfterMalformedRestoredSong(nativeQueueRef)
        ? { status: 'applied' as const, queue: [] as Song[], activeSong: null }
        : { status: 'failed' as const, queue: nativeQueueRef.current, activeSong: null,
          recoveryError: new Error('Failed to clear malformed hydrated queue.') })
      : await applyHydratedNativeQueue({ plan, nativeQueueRef, isCancelled });

    if (nativeResult.status === 'failed') {
      return hydratedStored;
    }
    if (isCancelled()) return hydratedStored;

    return commitHydratedNativeResult(plan, nativeResult, stored, {
      nativeQueueRef, queueContextRef, baseQueueContextRef, setPlaybackQueue, setCurrentSong,
    });
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

    await applyHydrationFailureFallback(args, error);
    hydrationCompleted = true;
  } finally {
    if (!isCancelled() && hydrationCompleted) setIsReady(true);
  }
};
