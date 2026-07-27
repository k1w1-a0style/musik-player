import type { MutableRefObject } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { Song } from '../types/Song';
import { runExclusiveNativeQueueReplacement } from '../utils/nativeQueueMutationLock';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';
import {
  commitNativeQueueTruth,
  classifyNativeQueueRecoveryFailure,
  createNativeQueueMutationSnapshot,
  readNativeQueueTruth,
  recoverNativeQueueMutation,
  persistNativeCurrentSong,
  type CurrentSongPersistenceResult,
  type NativeQueueRecoveryDiagnostics,
  NativeQueueReadbackUnstableError,
  type NativeQueueMutationSnapshot,
  type NativeQueueStateTargets,
} from './nativeQueueRecovery';
import type { HydrationPlan } from './musicHydrationPlan';
import { buildEmptyPlayableQueueHydrationContext, isEmptyPlayableQueueLegitimate } from './musicHydrationEmptyQueueLog';
import { createNativeHydrationExpectation, evaluateNativeHydrationFulfillment, type NativeHydrationExpectation } from './nativeHydrationPlanFulfillment';
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
  planStatus?: 'fulfilled' | 'retry-required';
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
const isHydrationResult = (value: NativeQueueMutationSnapshot | HydratedNativeQueueResult): value is HydratedNativeQueueResult =>
  'nativeStatus' in value;
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
): VerifiedHydratedNativeQueueResult => ({
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
const clearMalformedNativeCurrent = async ({ knownSongs, librarySongs, targets, previousPersistedId, shuffleEnabled, isCancelled }: {
  knownSongs: Song[]; librarySongs: Song[]; targets: NativeQueueStateTargets;
  previousPersistedId?: string | null; shuffleEnabled: boolean; isCancelled: () => boolean;
}): Promise<HydratedNativeQueueResult> => {
  if (isCancelled()) return { ...failedResult(targets, 'mutation'), nativeStatus: 'cancelled' };
  try {
    try {
      await TrackPlayer.reset();
    } catch (initialResetError) {
      if (isCancelled()) return { ...failedResult(targets, 'mutation', initialResetError), nativeStatus: 'cancelled' };
      console.warn('[MusicHydration:MalformedCurrentCleanup] Retrying rejected native reset.', initialResetError);
      await TrackPlayer.reset();
    }
    const readback = await readNativeQueueTruth(knownSongs);
    if (isCancelled()) return { ...failedResult(targets, 'readback'), nativeStatus: 'cancelled' };
    if (readback.queue.length !== 0 || readback.activeSong !== null) {
      throw new Error('Malformed-current cleanup did not produce an empty native queue.');
    }
    const state = await commitNativeQueueTruth({
      readback, preferredBaseQueue: [], librarySongs, targets, previousPersistedId,
      shuffleStrategy: { kind: 'confirmed-action', enabled: shuffleEnabled },
    });
    return toHydrationResult('applied', state);
  } catch (error) {
    try {
      const readback = await readNativeQueueTruth(knownSongs);
      if (isCancelled()) return { ...failedResult(targets, 'readback'), nativeStatus: 'cancelled' };
      if (readback.queue.length === 0 && readback.activeSong === null && readback.activeIndex === -1) {
        const state = await commitNativeQueueTruth({
          readback, preferredBaseQueue: [], librarySongs, targets, previousPersistedId,
          shuffleStrategy: { kind: 'confirmed-action', enabled: shuffleEnabled },
        });
        return toHydrationResult('reconciled', state);
      }
    } catch (readbackError) {
      if (readbackError instanceof NativeQueueReadbackUnstableError) {
        return { ...failedResult(targets, 'readback', readbackError), nativeStatus: 'readback-unstable' };
      }
    }
    const result = failedResult(targets, 'readback', error);
    return error instanceof NativeQueueReadbackUnstableError
      ? { ...result, nativeStatus: 'readback-unstable' }
      : result;
  }
};
const retryPostMutationReadback = async ({ knownSongs, librarySongs, targets, previousPersistedId,
  shuffleEnabled, preferredBaseQueue, expectation, isCancelled, recoveryErrors }: {
  knownSongs: Song[]; librarySongs: Song[]; targets: NativeQueueStateTargets; previousPersistedId?: string | null;
  shuffleEnabled: boolean; preferredBaseQueue: Song[]; expectation: NativeHydrationExpectation; isCancelled: () => boolean;
  recoveryErrors: NativeQueueRecoveryDiagnostics;
}): Promise<HydratedNativeQueueResult> => {
  for (let attempt = 2; attempt <= 3; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 50 * (attempt - 1)));
    if (isCancelled()) return { ...failedResult(targets, 'readback'), nativeStatus: 'cancelled', recoveryErrors };
    console.warn(`[MusicHydration:ReadbackUnstable] Retrying native truth readback ${attempt}/3.`, recoveryErrors);
    if (isCancelled()) return { ...failedResult(targets, 'readback'), nativeStatus: 'cancelled', recoveryErrors };
    try {
      const readback = await readNativeQueueTruth(knownSongs);
      if (isCancelled()) return { ...failedResult(targets, 'readback'), nativeStatus: 'cancelled', recoveryErrors };
      const fulfillment = evaluateNativeHydrationFulfillment(expectation, readback);
      const state = await commitNativeQueueTruth({
        readback, preferredBaseQueue, librarySongs, targets, previousPersistedId,
        shuffleStrategy: { kind: 'confirmed-action', enabled: shuffleEnabled },
        persistCurrentSong: fulfillment.fulfilled,
      });
      return { ...toHydrationResult('reconciled', state, recoveryErrors),
        planStatus: fulfillment.fulfilled ? 'fulfilled' : 'retry-required' };
    } catch (error) {
      if (!(error instanceof NativeQueueReadbackUnstableError)) {
        return { ...failedResult(targets, 'readback', error), recoveryErrors: { ...recoveryErrors, finalReadbackError: error } };
      }
    }
  }
  return { ...failedResult(targets, 'readback', recoveryErrors.originalError), nativeStatus: 'readback-unstable', recoveryErrors };
};
const createHydrationSnapshot = async ({ knownSongs, shuffleEnabled, targets, isCancelled }: {
  knownSongs: Song[]; shuffleEnabled: boolean; targets: NativeQueueStateTargets; isCancelled: () => boolean;
}): Promise<NativeQueueMutationSnapshot | HydratedNativeQueueResult> => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await createNativeQueueMutationSnapshot({ knownSongs, shuffleEnabled, targets });
    } catch (error) {
      if (!(error instanceof NativeQueueReadbackUnstableError) || attempt === 3) {
        const result = failedResult(targets, 'snapshot', error);
        return error instanceof NativeQueueReadbackUnstableError ? { ...result, nativeStatus: 'readback-unstable' } : result;
      }
      await new Promise(resolve => setTimeout(resolve, 50 * attempt));
      if (isCancelled()) return { ...failedResult(targets, 'snapshot'), nativeStatus: 'cancelled' };
    }
  }
  return { ...failedResult(targets, 'snapshot'), nativeStatus: 'readback-unstable' };
};
const toRecoveredHydrationResult = async (
  recovery: Exclude<Awaited<ReturnType<typeof recoverNativeQueueMutation>>, { status: 'failed' }>,
  expectation: NativeHydrationExpectation,
  librarySongs: Song[],
  previousPersistedId?: string | null,
): Promise<HydratedNativeQueueResult> => {
  const fulfillment = evaluateNativeHydrationFulfillment(expectation, recovery.readback);
  const currentSongPersistence = fulfillment.fulfilled
    ? await persistNativeCurrentSong(recovery.activeSong, librarySongs, previousPersistedId)
    : { status: 'not-required' as const };
  return {
    nativeStatus: recovery.status, verifiedState: 'confirmed', queue: recovery.queue,
    baseQueue: recovery.baseQueue, activeSong: recovery.activeSong, shuffleEnabled: recovery.shuffleEnabled,
    currentSongPersistence, recoveryErrors: recovery.diagnostics,
    persistenceError: currentSongPersistence.error,
    planStatus: fulfillment.fulfilled ? 'fulfilled' : 'retry-required',
  };
};
const applyHydrationPlanQueue = async (plan: HydrationPlan): Promise<void> => {
  if (plan.playableQueue.length === 0) logEmptyPlayableQueueHydration(plan);
  else await TrackPlayer.add(plan.playableQueue.map(toTrackPlayerTrack));
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
      // Sole mapping exception: this planned cleanup verifies an empty readback
      // before publishing state, instead of mapping the obsolete native track.
      if (plan.nativeQueueAction === 'clearMalformedCurrent') {
        return clearMalformedNativeCurrent({ knownSongs, librarySongs, targets, previousPersistedId, shuffleEnabled, isCancelled });
      }
      const snapshotResult = await createHydrationSnapshot({ knownSongs, shuffleEnabled, targets, isCancelled });
      if (isHydrationResult(snapshotResult)) return snapshotResult;
      const snapshot = snapshotResult;
      const expectation = createNativeHydrationExpectation(plan, snapshot);
      if (isCancelled()) return { ...failedResult(targets, 'snapshot'), nativeStatus: 'cancelled' };
      if (plan.nativeQueueAction === 'none') {
        const fulfillment = evaluateNativeHydrationFulfillment(expectation, snapshot);
        const state = await commitNativeQueueTruth({
          readback: snapshot, preferredBaseQueue: snapshot.baseQueue, librarySongs, targets, previousPersistedId,
          shuffleStrategy: { kind: 'confirmed-action', enabled: shuffleEnabled },
          persistCurrentSong: fulfillment.fulfilled,
        });
        return { ...toHydrationResult('noop', state), planStatus: fulfillment.fulfilled ? 'fulfilled' : 'retry-required' };
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
        await applyHydrationPlanQueue(plan);
        const readback = await readNativeQueueTruth(knownSongs);
        const fulfillment = evaluateNativeHydrationFulfillment(expectation, readback);
        const state = await commitNativeQueueTruth({
          readback, preferredBaseQueue: plan.hydratedQueue, librarySongs, targets, previousPersistedId,
          shuffleStrategy: { kind: 'confirmed-action', enabled: shuffleEnabled },
          persistCurrentSong: fulfillment.fulfilled,
        });
        return { ...toHydrationResult('applied', state), planStatus: fulfillment.fulfilled ? 'fulfilled' : 'retry-required' };
      } catch (error) {
        const recovery = await recoverNativeQueueMutation({
          originalError: error, snapshot, knownSongs, librarySongs, targets,
          preferredBaseQueue: plan.hydratedQueue,
          reconciliationShuffleStrategy: { kind: 'confirmed-action', enabled: shuffleEnabled },
          persistCurrentSong: false,
        });
        if (recovery.status === 'failed') {
          const result = { ...failedResult(targets, 'readback', error), recoveryErrors: recovery.diagnostics };
          if (classifyNativeQueueRecoveryFailure(recovery.diagnostics) !== 'readback-unstable') return result;
          return retryPostMutationReadback({
            knownSongs, librarySongs, targets, previousPersistedId, shuffleEnabled,
            preferredBaseQueue: plan.hydratedQueue, expectation,
            isCancelled, recoveryErrors: recovery.diagnostics,
          });
        }
        return toRecoveredHydrationResult(recovery, expectation, librarySongs, previousPersistedId);
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
