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
  sanitizeStoredPlaylistsForHydration,
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
import { runExclusiveNativePlaybackControl } from '../utils/nativeQueueMutationLock';
import { commitNativeQueueTruth, readNativeQueueTruth } from './nativeQueueRecovery';
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

export type HydrateStoredSongsResult = StoredMusicHydrationState & HydratedNativeQueueResult & {
  libraryHydrationStatus: 'empty-missing-key' | 'stored';
};

const withoutNativeMutation = (
  stored: StoredMusicHydrationState,
  refs: Pick<HydrateStoredSongsArgs, 'nativeQueueRef' | 'queueContextRef' | 'baseQueueContextRef'>,
): HydrateStoredSongsResult => ({
  ...stored,
  libraryHydrationStatus: stored.songs === null ? 'empty-missing-key' : 'stored',
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

export const verifySupersededHydration = async (
  nativeResult: HydratedNativeQueueResult,
  args: Pick<HydrateStoredSongsArgs, 'songsRef' | 'nativeQueueRef' | 'queueContextRef' | 'baseQueueContextRef' | 'setPlaybackQueue' | 'setCurrentSong'>,
): Promise<HydratedNativeQueueResult> => {
  if (nativeResult.nativeStatus !== 'stale') return nativeResult;
  const originalError = nativeResult.recoveryErrors?.originalError
    ?? new Error('Native queue hydration was superseded before it started.');
  try {
    return await runExclusiveNativePlaybackControl(async () => {
      const knownSongs = [
        ...args.songsRef.current, ...args.nativeQueueRef.current,
        ...args.queueContextRef.current, ...args.baseQueueContextRef.current,
      ];
      const state = await commitNativeQueueTruth({
        readback: await readNativeQueueTruth(knownSongs),
        preferredBaseQueue: args.baseQueueContextRef.current,
        librarySongs: args.songsRef.current,
        targets: args,
        shuffleStrategy: { kind: 'derive-from-order' },
      });
      return {
        nativeStatus: 'reconciled', verifiedState: 'confirmed', queue: state.queue,
        baseQueue: state.baseQueue, activeSong: state.activeSong, shuffleEnabled: state.shuffleEnabled,
        currentSongPersistence: state.currentSongPersistence,
        recoveryErrors: { originalError }, persistenceError: state.persistenceError,
      };
    });
  } catch (error) {
    return {
      ...nativeResult, nativeStatus: 'failed', failureStage: 'readback',
      recoveryErrors: { originalError, finalReadbackError: error },
    };
  }
};

const createStoredHydrationPlan = (stored: StoredMusicHydrationState, sanitizedSongs: Song[]) => {
  const plan = createHydrationPlan(stored, sanitizedSongs);
  if (stored.songs !== null) return plan;
  const normalizedPlaylists = sanitizeStoredPlaylistsForHydration(stored);
  return {
    ...plan,
    normalizedPlaylists,
    shouldPersistPlaylists: normalizedPlaylists != null && normalizedPlaylists !== stored.playlists,
  };
};

const toHydratedStoredState = (
  stored: StoredMusicHydrationState,
  plan: ReturnType<typeof createHydrationPlan>,
): StoredMusicHydrationState & { libraryHydrationStatus: 'empty-missing-key' | 'stored' } => {
  const planned = applyHydrationPlanToStoredState(stored, plan);
  if (stored.songs !== null) return { ...planned, libraryHydrationStatus: 'stored' };
  return { ...planned, songs: null, libraryHydrationStatus: 'empty-missing-key' };
};

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
  const sourceSongs = stored.songs ?? [];
  const coverLease = acquireSongCoverProtection(sourceSongs);
  try {
    const sanitizedSongs = await sanitizeSongsForStorage(sourceSongs, coverLease.protection);
    if (isCancelled()) return withoutNativeMutation(stored, refs);

    coverLease.updateSnapshot(sanitizedSongs);
    const plan = createStoredHydrationPlan(stored, sanitizedSongs);

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

    const hydratedStored = toHydratedStoredState(stored, plan);

    const initialNativeResult = await applyHydratedNativeQueue({
      plan,
      nativeQueueRef,
      isCancelled,
      librarySongs: plan.hydratedSongs,
      shuffleEnabled: stored.shuffle ?? false,
      targets: { nativeQueueRef, queueContextRef, baseQueueContextRef, setPlaybackQueue, setCurrentSong },
    });
    const nativeResult = isCancelled() ? initialNativeResult : await verifySupersededHydration(initialNativeResult, {
      songsRef, nativeQueueRef, queueContextRef, baseQueueContextRef, setPlaybackQueue, setCurrentSong,
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
    if (hydratedStored.verifiedState === null) {
      throw hydratedStored.recoveryErrors?.originalError
        ?? new Error(`Native queue hydration was not verified (${hydratedStored.nativeStatus}:${hydratedStored.failureStage}).`);
    }

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
