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
  NativeQueueReadbackUnstableError,
  type NativeQueueMutationSnapshot,
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
interface VerifiedHydratedNativeQueueResult {
  nativeStatus: 'applied' | 'reconciled' | 'rolled-back' | 'noop';
  verifiedState: 'confirmed';
  queue: Song[];
  baseQueue: Song[];
  activeSong: Song | null;
  shuffleEnabled: boolean;
  currentSongPersistence: CurrentSongPersistenceResult;
  recoveryErrors?: NativeQueueRecoveryDiagnostics;
  persistenceError?: unknown;
  superseded?: true;
}
interface UnverifiedHydratedNativeQueueResult {
  nativeStatus: 'failed' | 'cancelled' | 'superseded' | 'readback-unstable';
  verifiedState: null;
  lastKnownUnverifiedState: {
    nativeQueueRef: Song[];
    logicalQueue: Song[];
    baseQueue: Song[];
  };
  currentSongPersistence: CurrentSongPersistenceResult;
  recoveryErrors?: NativeQueueRecoveryDiagnostics;
  failureStage: 'snapshot' | 'mutation' | 'readback' | 'commit' | 'exclusive-action';
}
export type HydratedNativeQueueResult = VerifiedHydratedNativeQueueResult | UnverifiedHydratedNativeQueueResult;
const failedResult = (
  targets: NativeQueueStateTargets,
  failureStage: UnverifiedHydratedNativeQueueResult['failureStage'],
  error?: unknown,
): UnverifiedHydratedNativeQueueResult => ({
  nativeStatus: 'failed',
  verifiedState: null,
  lastKnownUnverifiedState: {
    nativeQueueRef: targets.nativeQueueRef.current.slice(),
    logicalQueue: targets.queueContextRef.current.slice(),
    baseQueue: targets.baseQueueContextRef.current.slice(),
  },
  currentSongPersistence: { status: 'not-required' },
  recoveryErrors: error ? { originalError: error } : undefined,
  failureStage,
});
const targetsForNativeRef = (nativeQueueRef: MutableRefObject<Song[]>): NativeQueueStateTargets => ({
  nativeQueueRef,
  queueContextRef: { current: nativeQueueRef.current.slice() },
  baseQueueContextRef: { current: nativeQueueRef.current.slice() },
  setPlaybackQueue: () => undefined,
  setCurrentSong: () => undefined,
});
const toHydrationResult = (
  nativeStatus: VerifiedHydratedNativeQueueResult['nativeStatus'],
  state: Awaited<ReturnType<typeof commitNativeQueueTruth>>,
  recoveryErrors?: NativeQueueRecoveryDiagnostics,
): HydratedNativeQueueResult => ({
  nativeStatus,
  verifiedState: 'confirmed',
  queue: state.queue,
  baseQueue: state.baseQueue,
  activeSong: state.activeSong,
  shuffleEnabled: state.shuffleEnabled,
  currentSongPersistence: state.currentSongPersistence,
  recoveryErrors,
  persistenceError: state.persistenceError,
});
const clearMalformedNativeCurrent = async ({ knownSongs, librarySongs, targets, previousPersistedId, shuffleEnabled }: {
  knownSongs: Song[]; librarySongs: Song[]; targets: NativeQueueStateTargets;
  previousPersistedId?: string | null; shuffleEnabled: boolean;
}): Promise<HydratedNativeQueueResult> => {
  try {
    try {
      await TrackPlayer.reset();
    } catch (initialResetError) {
      console.warn('[MusicHydration:MalformedCurrentCleanup] Retrying rejected native reset.', initialResetError);
      await TrackPlayer.reset();
    }
    const readback = await readNativeQueueTruth(knownSongs);
    if (readback.queue.length !== 0 || readback.activeSong !== null) {
      throw new Error('Malformed-current cleanup did not produce an empty native queue.');
    }
    const state = await commitNativeQueueTruth({
      readback, preferredBaseQueue: [], librarySongs, targets, previousPersistedId,
      shuffleStrategy: { kind: 'confirmed-action', enabled: shuffleEnabled },
    });
    return toHydrationResult('applied', state);
  } catch (error) {
    const result = failedResult(targets, 'readback', error);
    return error instanceof NativeQueueReadbackUnstableError
      ? { ...result, nativeStatus: 'readback-unstable' }
      : result;
  }
};
export const applyHydratedNativeQueue = async ({ plan, nativeQueueRef, isCancelled,
  targets = targetsForNativeRef(nativeQueueRef), librarySongs = plan.hydratedSongs, shuffleEnabled = false,
}: ApplyHydratedNativeQueueArgs): Promise<HydratedNativeQueueResult> => {
  const knownSongs = [...librarySongs, ...plan.playableQueue, ...nativeQueueRef.current];
  const previousPersistedId = plan.currentSongPersistence.action === 'keep'
    ? plan.resolvedCurrentSongId
    : undefined;
  try {
    return await runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      if (!isCurrent()) return { ...failedResult(targets, 'snapshot'), nativeStatus: 'superseded' };
      if (isCancelled()) return { ...failedResult(targets, 'snapshot'), nativeStatus: 'cancelled' };
      // This is the sole fail-open mapping exception. The cleanup is explicitly
      // intended to remove a persisted current track which no longer belongs to
      // the library, so taking the normal Song-mapped snapshot would reject the
      // very native track we need to clear. No native state is published until
      // reset has been verified by a normal (necessarily empty) readback.
      if (plan.nativeQueueAction === 'clearMalformedCurrent') {
        return clearMalformedNativeCurrent({ knownSongs, librarySongs, targets, previousPersistedId, shuffleEnabled });
      }
      let snapshot: NativeQueueMutationSnapshot;
      try {
        snapshot = await createNativeQueueMutationSnapshot({ knownSongs, shuffleEnabled, targets });
      } catch (error) {
        const result = failedResult(targets, 'snapshot', error);
        return error instanceof NativeQueueReadbackUnstableError ? { ...result, nativeStatus: 'readback-unstable' } : result;
      }
      if (isCancelled()) return { ...failedResult(targets, 'snapshot'), nativeStatus: 'cancelled' };
      if (plan.nativeQueueAction === 'none') {
        const state = await commitNativeQueueTruth({
          readback: snapshot, preferredBaseQueue: snapshot.baseQueue, librarySongs, targets, previousPersistedId,
          shuffleStrategy: { kind: 'confirmed-action', enabled: shuffleEnabled },
        });
        return toHydrationResult('noop', state);
      }
      try {
        await TrackPlayer.reset();
        if (isCancelled()) {
          const state = await commitNativeQueueTruth({
            readback: await readNativeQueueTruth(knownSongs), preferredBaseQueue: [], librarySongs, targets, previousPersistedId,
            shuffleStrategy: { kind: 'confirmed-action', enabled: false },
          });
          return toHydrationResult('reconciled', state);
        }
        if (plan.playableQueue.length === 0) {
          if (plan.playableQueue.length === 0) logEmptyPlayableQueueHydration(plan);
        } else {
          await TrackPlayer.add(plan.playableQueue.map(toTrackPlayerTrack));
        }
        const readback = await readNativeQueueTruth(knownSongs);
        const state = await commitNativeQueueTruth({
          readback, preferredBaseQueue: plan.hydratedQueue, librarySongs, targets, previousPersistedId,
          shuffleStrategy: { kind: 'confirmed-action', enabled: shuffleEnabled },
        });
        return toHydrationResult('applied', state);
      } catch (error) {
        const recovery = await recoverNativeQueueMutation({
          originalError: error, snapshot, knownSongs, librarySongs, targets,
          preferredBaseQueue: plan.hydratedQueue,
          reconciliationShuffleStrategy: { kind: 'confirmed-action', enabled: shuffleEnabled },
        });
        if (recovery.status === 'failed') {
          return { ...failedResult(targets, 'readback', error), recoveryErrors: recovery.diagnostics };
        }
        return {
          nativeStatus: recovery.status,
          verifiedState: 'confirmed',
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
    return failedResult(targets, 'exclusive-action', error);
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
