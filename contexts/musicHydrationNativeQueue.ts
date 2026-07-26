import type { MutableRefObject } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { Song } from '../types/Song';
import { runExclusiveNativeQueueReplacement } from '../utils/nativeQueueMutationLock';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';
import {
  commitNativeQueueTruth,
  createNativeQueueMutationSnapshot,
  readNativeQueueTruth,
  recoverNativeQueueMutation,
  type CurrentSongPersistenceResult,
  type NativeQueueRecoveryDiagnostics,
  type NativeQueueStateTargets,
} from './nativeQueueRecovery';
import type { HydrationPlan } from './musicHydrationPlan';
import { buildEmptyPlayableQueueHydrationContext, isEmptyPlayableQueueLegitimate } from './musicHydrationEmptyQueueLog';

export interface ApplyHydratedNativeQueueArgs {
  plan: HydrationPlan;
  nativeQueueRef: MutableRefObject<Song[]>;
  isCancelled: () => boolean;
  targets?: NativeQueueStateTargets;
  librarySongs?: Song[];
  shuffleEnabled?: boolean;
}

export interface HydratedNativeQueueResult {
  nativeStatus: 'applied' | 'reconciled' | 'rolled-back' | 'failed' | 'stale' | 'noop';
  queue: Song[];
  baseQueue: Song[];
  activeSong: Song | null;
  shuffleEnabled: boolean;
  currentSongPersistence: CurrentSongPersistenceResult;
  recoveryErrors?: NativeQueueRecoveryDiagnostics;
  persistenceError?: unknown;
}

const failedResult = (nativeQueueRef: MutableRefObject<Song[]>, error?: unknown): HydratedNativeQueueResult => ({
  nativeStatus: 'failed',
  queue: nativeQueueRef.current.slice(),
  baseQueue: nativeQueueRef.current.slice(),
  activeSong: null,
  shuffleEnabled: false,
  currentSongPersistence: { status: 'not-required' },
  recoveryErrors: error ? { finalReadbackError: error } : undefined,
});

const targetsForNativeRef = (nativeQueueRef: MutableRefObject<Song[]>): NativeQueueStateTargets => ({
  nativeQueueRef,
  queueContextRef: { current: nativeQueueRef.current.slice() },
  baseQueueContextRef: { current: nativeQueueRef.current.slice() },
  setPlaybackQueue: () => undefined,
  setCurrentSong: () => undefined,
});

const toHydrationResult = (
  nativeStatus: HydratedNativeQueueResult['nativeStatus'],
  state: Awaited<ReturnType<typeof commitNativeQueueTruth>>,
  recoveryErrors?: NativeQueueRecoveryDiagnostics,
): HydratedNativeQueueResult => ({
  nativeStatus,
  queue: state.queue,
  baseQueue: state.baseQueue,
  activeSong: state.activeSong,
  shuffleEnabled: state.shuffleEnabled,
  currentSongPersistence: state.currentSongPersistence,
  recoveryErrors,
  persistenceError: state.persistenceError,
});

export const applyHydratedNativeQueue = async ({
  plan,
  nativeQueueRef,
  isCancelled,
  targets = targetsForNativeRef(nativeQueueRef),
  librarySongs = plan.hydratedSongs,
  shuffleEnabled = false,
}: ApplyHydratedNativeQueueArgs): Promise<HydratedNativeQueueResult> => {
  const knownSongs = [...librarySongs, ...plan.playableQueue, ...nativeQueueRef.current];
  const previousPersistedId = plan.currentSongPersistence.action === 'keep'
    ? plan.resolvedCurrentSongId
    : undefined;
  try {
    return await runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      if (!isCurrent() || isCancelled()) return { ...failedResult(nativeQueueRef), nativeStatus: 'stale' };
      const snapshot = await createNativeQueueMutationSnapshot({
        knownSongs, currentSong: plan.restoredSong, shuffleEnabled, targets,
      });
      if (plan.nativeQueueAction === 'none') {
        const state = await commitNativeQueueTruth({
          readback: snapshot, preferredBaseQueue: snapshot.baseQueue, librarySongs, targets, previousPersistedId,
        });
        return toHydrationResult('noop', state);
      }
      try {
        await TrackPlayer.reset();
        if (isCancelled()) {
          const state = await commitNativeQueueTruth({
            readback: await readNativeQueueTruth(knownSongs), preferredBaseQueue: [], librarySongs, targets, previousPersistedId,
          });
          return toHydrationResult('reconciled', state);
        }
        if (plan.playableQueue.length === 0 || plan.nativeQueueAction === 'clearMalformedCurrent') {
          if (plan.playableQueue.length === 0) logEmptyPlayableQueueHydration(plan);
        } else {
          await TrackPlayer.add(plan.playableQueue.map(toTrackPlayerTrack));
        }
        const readback = await readNativeQueueTruth(knownSongs);
        const state = await commitNativeQueueTruth({
          readback, preferredBaseQueue: plan.hydratedQueue, librarySongs, targets, previousPersistedId,
        });
        return toHydrationResult('applied', state);
      } catch (error) {
        const recovery = await recoverNativeQueueMutation({
          originalError: error, snapshot, knownSongs, librarySongs, targets,
          preferredBaseQueue: plan.hydratedQueue,
        });
        if (recovery.status === 'failed') {
          return { ...failedResult(nativeQueueRef, error), recoveryErrors: recovery };
        }
        return {
          nativeStatus: recovery.status,
          queue: recovery.queue,
          baseQueue: recovery.baseQueue,
          activeSong: recovery.activeSong,
          shuffleEnabled: recovery.shuffleEnabled,
          currentSongPersistence: recovery.currentSongPersistence,
          recoveryErrors: recovery.diagnostics,
          persistenceError: recovery.persistenceError,
        };
      }
    });
  } catch (error) {
    return failedResult(nativeQueueRef, error);
  }
};

export const clearNativeQueueAfterMalformedRestoredSong = async (
  nativeQueueRef: MutableRefObject<Song[]>,
): Promise<boolean> => {
  try {
    await TrackPlayer.reset();
    nativeQueueRef.current = [];
    return true;
  } catch (error) {
    console.warn('[PlaybackQueue] Failed to reset native queue after dropping malformed restored song.', error);
    return false;
  }
};

export const resetNativeQueueAfterHydrationFailure = async (
  nativeQueueRef: MutableRefObject<Song[]>,
): Promise<boolean> => {
  try {
    await TrackPlayer.reset();
    nativeQueueRef.current = [];
    return true;
  } catch (error) {
    console.warn('[MusicHydration:TrackPlayerError] Failed to reset native queue after hydration failure.', error);
    return false;
  }
};

const logEmptyPlayableQueueHydration = (plan: HydrationPlan): void => {
  const context = buildEmptyPlayableQueueHydrationContext(plan);
  if (isEmptyPlayableQueueLegitimate(plan)) {
    // eslint-disable-next-line no-console
    console.info('[PlaybackQueue] Hydration produced no playable songs (empty library / first launch).', context);
    return;
  }
  console.warn('[PlaybackQueue] Hydration produced no playable songs for native queue.', context);
};
