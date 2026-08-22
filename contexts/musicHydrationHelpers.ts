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
import { publishNativeHydrationGate } from '../utils/nativeHydrationGate';
import type { NativeHydrationGateOwner, NativeHydrationGateStatus } from '../utils/nativeHydrationGate';
import { startStartupTimer } from '../utils/startupTiming';

const publishHydrationStatus = (
  owner: NativeHydrationGateOwner | undefined,
  setter: RunMusicHydrationArgs['setHydrationStatus'],
  status: NativeHydrationGateStatus,
): void => {
  if (owner && !publishNativeHydrationGate(owner, status)) return;
  setter?.(status);
};

const completeHydrationFallback = (
  fallback: Awaited<ReturnType<typeof applyHydrationFailureFallback>>,
  isCancelled: () => boolean,
  gateOwner: NativeHydrationGateOwner | undefined,
  setHydrationStatus: RunMusicHydrationArgs['setHydrationStatus'],
): boolean => {
  if (isCancelled()) return false;
  if (fallback.status === 'failed') {
    publishHydrationStatus(gateOwner, setHydrationStatus, 'degraded');
    return false;
  }
  return true;
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

export type HydrateStoredSongsResult = StoredMusicHydrationState & HydratedNativeQueueResult & {
  libraryHydrationStatus: 'empty-missing-key' | 'stored';
};

const withoutNativeMutation = (
  stored: StoredMusicHydrationState,
  refs: Pick<HydrateStoredSongsArgs, 'nativeQueueRef' | 'queueContextRef' | 'baseQueueContextRef'>,
): HydrateStoredSongsResult => ({
  ...stored,
  libraryHydrationStatus: stored.songs === null ? 'empty-missing-key' : 'stored',
  nativeStatus: 'cancelled',
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
  if (nativeResult.nativeStatus !== 'superseded') return nativeResult;
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
        recoveryErrors: { originalError }, persistenceError: state.persistenceError, superseded: true,
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
  onLibraryHydrated,
  beforeNativeHydration,
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
    onLibraryHydrated?.(plan.normalizedPlaylists ?? []);

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

    await beforeNativeHydration?.();
    if (isCancelled()) return withoutNativeMutation(stored, refs);

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

type MusicHydrationOutcome = 'failed' | 'ready' | 'retry-required' | 'degraded' | 'fallback-ready' | 'cancelled';
type FinishStartupTiming = ReturnType<typeof startStartupTimer>;
type MusicHydrationCoreArgs = Omit<RunMusicHydrationArgs,
  'setIsReady' | 'setLibraryHydrationReady' | 'setHydrationStatus' | 'gateOwner'>;

interface MusicHydrationTimings {
  hydration: FinishStartupTiming;
  trackPlayer: FinishStartupTiming;
  storage: FinishStartupTiming;
  library: FinishStartupTiming;
}

type TrackPlayerSetupOutcome = Promise<{ ok: true } | { ok: false; error: unknown }>;

const createMusicHydrationTimings = (): MusicHydrationTimings => ({
  hydration: startStartupTimer('music-hydration'),
  trackPlayer: startStartupTimer('track-player-setup'),
  storage: startStartupTimer('music-storage'),
  library: startStartupTimer('music-library'),
});

const startTrackPlayerHydrationSetup = (finish: FinishStartupTiming): TrackPlayerSetupOutcome =>
  setupTrackPlayer().then(
    () => { finish('ready'); return { ok: true as const }; },
    error => { finish('failed'); return { ok: false as const, error }; },
  );

const requireTrackPlayerSetup = async (setup: TrackPlayerSetupOutcome): Promise<void> => {
  const outcome = await setup;
  if (!outcome.ok) throw outcome.error;
};

const loadStoredStateForHydration = async (finish: FinishStartupTiming): Promise<StoredMusicHydrationState> => {
  try {
    const stored = await loadStoredMusicHydrationState();
    finish('ready');
    return stored;
  } catch (error) {
    finish('failed');
    console.warn('[MusicHydration:StorageError] Failed to load stored hydration state.', error);
    throw error;
  }
};

const runPrimaryMusicHydration = async ({
  args,
  setLibraryHydrationReady,
  setHydrationStatus,
  gateOwner,
  trackPlayerSetup,
  timings,
}: {
  args: MusicHydrationCoreArgs;
  setLibraryHydrationReady: RunMusicHydrationArgs['setLibraryHydrationReady'];
  setHydrationStatus: RunMusicHydrationArgs['setHydrationStatus'];
  gateOwner: NativeHydrationGateOwner | undefined;
  trackPlayerSetup: TrackPlayerSetupOutcome;
  timings: MusicHydrationTimings;
}): Promise<MusicHydrationOutcome> => {
  const stored = await loadStoredStateForHydration(timings.storage);
  if (args.isCancelled()) return 'cancelled';

  const hydratedStored = await hydrateStoredSongs({
    stored,
    ...args,
    beforeNativeHydration: () => requireTrackPlayerSetup(trackPlayerSetup),
    onLibraryHydrated: playlists => {
      args.setPlaylists(playlists);
      setLibraryHydrationReady?.(true);
      timings.library('ready', {
        songCount: args.songsRef.current.length,
        playlistCount: playlists.length,
      });
    },
  }).catch(error => {
    console.warn('[MusicHydration:SanitizeError] Failed while hydrating stored songs.', error);
    throw error;
  });

  if (args.isCancelled()) return 'cancelled';
  if (hydratedStored.verifiedState === 'confirmed' && hydratedStored.planStatus === 'retry-required') {
    console.error('[MusicHydration:RetryRequired] Native truth was verified but the stored hydration plan was not restored.');
    publishHydrationStatus(gateOwner, setHydrationStatus, 'retry-required');
    return 'retry-required';
  }
  if (hydratedStored.verifiedState === null) {
    if (hydratedStored.nativeStatus === 'readback-unstable') {
      console.error('[MusicHydration:ReadbackFailed] Native readback remained unstable; publishing degraded hydration state.',
        hydratedStored.recoveryErrors?.originalError);
      publishHydrationStatus(gateOwner, setHydrationStatus, 'degraded');
      return 'degraded';
    }
    throw hydratedStored.recoveryErrors?.originalError
      ?? new Error(`Native queue hydration was not verified (${hydratedStored.nativeStatus}:${hydratedStored.failureStage}).`);
  }

  try {
    await applyStoredPlaybackSettings({
      stored: hydratedStored,
      skipShuffle: hydratedStored.superseded === true,
      ...args,
    });
    return 'ready';
  } catch (error) {
    console.warn('[MusicHydration:TrackPlayerError] Failed to apply stored playback settings.', error);
    throw error;
  }
};

const runMusicHydrationFallback = async (
  args: MusicHydrationCoreArgs,
  trackPlayerSetup: TrackPlayerSetupOutcome,
  error: unknown,
  gateOwner: NativeHydrationGateOwner | undefined,
  setHydrationStatus: RunMusicHydrationArgs['setHydrationStatus'],
): Promise<{ completed: boolean; outcome: MusicHydrationOutcome }> => {
  if (args.isCancelled()) return { completed: false, outcome: 'cancelled' };
  // Fallback must never race an in-flight native setup attempt. The captured
  // outcome also prevents an unhandled rejection when storage failed first.
  await trackPlayerSetup;
  if (args.isCancelled()) return { completed: false, outcome: 'cancelled' };
  const fallback = await applyHydrationFailureFallback(args, error);
  const completed = completeHydrationFallback(fallback, args.isCancelled, gateOwner, setHydrationStatus);
  const outcome = completed ? 'fallback-ready' : fallback.status === 'failed' ? 'degraded' : 'cancelled';
  return { completed, outcome };
};

const finishMusicHydration = (
  outcome: MusicHydrationOutcome,
  completed: boolean,
  args: MusicHydrationCoreArgs,
  timings: MusicHydrationTimings,
  setIsReady: RunMusicHydrationArgs['setIsReady'],
  gateOwner: NativeHydrationGateOwner | undefined,
  setHydrationStatus: RunMusicHydrationArgs['setHydrationStatus'],
): void => {
  const cancelled = args.isCancelled();
  const finalOutcome = cancelled ? 'cancelled' : outcome;
  timings.storage(finalOutcome);
  timings.library(finalOutcome);
  timings.hydration(finalOutcome);
  if (!cancelled && completed) {
    setIsReady(true);
    publishHydrationStatus(gateOwner, setHydrationStatus, 'ready');
  }
};

export const runMusicHydration = async ({
  setIsReady,
  setLibraryHydrationReady,
  setHydrationStatus,
  gateOwner,
  ...args
}: RunMusicHydrationArgs): Promise<void> => {
  const timings = createMusicHydrationTimings();
  const trackPlayerSetup = startTrackPlayerHydrationSetup(timings.trackPlayer);
  let completed = false;
  let outcome: MusicHydrationOutcome = 'failed';
  try {
    outcome = await runPrimaryMusicHydration({
      args, setLibraryHydrationReady, setHydrationStatus, gateOwner, trackPlayerSetup, timings,
    });
    completed = outcome === 'ready';
  } catch (error) {
    const fallback = await runMusicHydrationFallback(args, trackPlayerSetup, error, gateOwner, setHydrationStatus);
    completed = fallback.completed;
    outcome = fallback.outcome;
  } finally {
    finishMusicHydration(outcome, completed, args, timings, setIsReady, gateOwner, setHydrationStatus);
  }
};
