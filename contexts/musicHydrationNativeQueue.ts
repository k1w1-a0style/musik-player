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
import {
  createNativeHydrationExpectation,
  evaluateNativeHydrationFulfillment,
  type NativeHydrationExpectation,
} from './nativeHydrationPlanFulfillment';

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

interface HydrationExecutionContext {
  plan: HydrationPlan;
  knownSongs: Song[];
  librarySongs: Song[];
  targets: NativeQueueStateTargets;
  previousPersistedId?: string | null;
  shuffleEnabled: boolean;
  isCancelled: () => boolean;
}

export type HydratedNativeQueueResult = VerifiedHydratedNativeQueueResult | UnverifiedHydratedNativeQueueResult;

const isHydrationResult = (
  value: NativeQueueMutationSnapshot | HydratedNativeQueueResult,
): value is HydratedNativeQueueResult => 'nativeStatus' in value;

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

const cancelledResult = (
  targets: NativeQueueStateTargets,
  failureStage: UnverifiedHydratedNativeQueueResult['failureStage'],
  error?: unknown,
): UnverifiedHydratedNativeQueueResult => ({
  ...failedResult(targets, failureStage, error),
  nativeStatus: 'cancelled',
});

const targetsForNativeRef = (nativeQueueRef: MutableRefObject<Song[]>): NativeQueueStateTargets => ({
  nativeQueueRef,
  queueContextRef: { current: nativeQueueRef.current.slice() },
  baseQueueContextRef: { current: nativeQueueRef.current.slice() },
  setPlaybackQueue: () => undefined,
  setCurrentSong: () => undefined,
});

const guardMutableRef = <T>(ref: MutableRefObject<T>, canWrite: () => boolean): MutableRefObject<T> => ({
  get current(): T {
    return ref.current;
  },
  set current(value: T) {
    if (canWrite()) ref.current = value;
  },
});

const guardNativeQueueTargets = (
  targets: NativeQueueStateTargets,
  canWrite: () => boolean,
): NativeQueueStateTargets => {
  const guarded: NativeQueueStateTargets = {
    nativeQueueRef: guardMutableRef(targets.nativeQueueRef, canWrite),
    queueContextRef: guardMutableRef(targets.queueContextRef, canWrite),
    baseQueueContextRef: guardMutableRef(targets.baseQueueContextRef, canWrite),
    setPlaybackQueue: next => { if (canWrite()) targets.setPlaybackQueue(next); },
    setCurrentSong: next => { if (canWrite()) targets.setCurrentSong(next); },
  };
  if (targets.shuffleRef) guarded.shuffleRef = guardMutableRef(targets.shuffleRef, canWrite);
  if (targets.setShuffle) guarded.setShuffle = next => { if (canWrite()) targets.setShuffle?.(next); };
  return guarded;
};

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

const shouldPersistExpectedCurrentSong = (
  expectation: NativeHydrationExpectation,
  fulfilled: boolean,
): boolean => fulfilled && expectation.active.kind !== 'unspecified';

const emptyNativeExpectation: NativeHydrationExpectation = {
  queueIds: [],
  active: { kind: 'none' },
};

const commitHydrationReadback = async ({
  readback,
  nativeStatus,
  expectation,
  preferredBaseQueue,
  recoveryErrors,
  context,
}: {
  readback: Awaited<ReturnType<typeof readNativeQueueTruth>>;
  nativeStatus: VerifiedHydratedNativeQueueResult['nativeStatus'];
  expectation: NativeHydrationExpectation;
  preferredBaseQueue: Song[];
  recoveryErrors?: NativeQueueRecoveryDiagnostics;
  context: HydrationExecutionContext;
}): Promise<HydratedNativeQueueResult> => {
  if (context.isCancelled()) return cancelledResult(context.targets, 'readback');
  const fulfillment = evaluateNativeHydrationFulfillment(expectation, readback);
  const state = await commitNativeQueueTruth({
    readback,
    preferredBaseQueue,
    librarySongs: context.librarySongs,
    targets: context.targets,
    previousPersistedId: context.previousPersistedId,
    shuffleStrategy: { kind: 'confirmed-action', enabled: context.shuffleEnabled },
    persistCurrentSong: shouldPersistExpectedCurrentSong(expectation, fulfillment.fulfilled),
  });
  return {
    ...toHydrationResult(nativeStatus, state, recoveryErrors),
    planStatus: fulfillment.fulfilled ? 'fulfilled' : 'retry-required',
  };
};

const clearMalformedNativeCurrent = async (
  context: HydrationExecutionContext,
): Promise<HydratedNativeQueueResult> => {
  if (context.isCancelled()) return cancelledResult(context.targets, 'mutation');
  try {
    try {
      await TrackPlayer.reset();
    } catch (initialResetError) {
      if (context.isCancelled()) return cancelledResult(context.targets, 'mutation', initialResetError);
      console.warn('[MusicHydration:MalformedCurrentCleanup] Retrying rejected native reset.', initialResetError);
      await TrackPlayer.reset();
    }
    if (context.isCancelled()) return cancelledResult(context.targets, 'mutation');
    return commitHydrationReadback({
      readback: await readNativeQueueTruth(context.knownSongs),
      nativeStatus: 'applied',
      expectation: emptyNativeExpectation,
      preferredBaseQueue: [],
      context,
    });
  } catch {
    try {
      return commitHydrationReadback({
        readback: await readNativeQueueTruth(context.knownSongs),
        nativeStatus: 'reconciled',
        expectation: emptyNativeExpectation,
        preferredBaseQueue: [],
        context,
      });
    } catch (readbackError) {
      const result = failedResult(context.targets, 'readback', readbackError);
      return readbackError instanceof NativeQueueReadbackUnstableError
        ? { ...result, nativeStatus: 'readback-unstable' }
        : result;
    }
  }
};

const retryPostMutationReadback = async ({
  expectation,
  recoveryErrors,
  context,
}: {
  expectation: NativeHydrationExpectation;
  recoveryErrors: NativeQueueRecoveryDiagnostics;
  context: HydrationExecutionContext;
}): Promise<HydratedNativeQueueResult> => {
  for (let attempt = 2; attempt <= 3; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 50 * (attempt - 1)));
    if (context.isCancelled()) return { ...cancelledResult(context.targets, 'readback'), recoveryErrors };
    console.warn(`[MusicHydration:ReadbackUnstable] Retrying native truth readback ${attempt}/3.`, recoveryErrors);
    try {
      return await commitHydrationReadback({
        readback: await readNativeQueueTruth(context.knownSongs),
        nativeStatus: 'reconciled',
        expectation,
        preferredBaseQueue: context.plan.hydratedQueue,
        recoveryErrors,
        context,
      });
    } catch (error) {
      if (!(error instanceof NativeQueueReadbackUnstableError)) {
        return {
          ...failedResult(context.targets, 'readback', error),
          recoveryErrors: { ...recoveryErrors, finalReadbackError: error },
        };
      }
    }
  }
  return {
    ...failedResult(context.targets, 'readback', recoveryErrors.originalError),
    nativeStatus: 'readback-unstable',
    recoveryErrors,
  };
};

const createHydrationSnapshot = async (
  context: HydrationExecutionContext,
): Promise<NativeQueueMutationSnapshot | HydratedNativeQueueResult> => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await createNativeQueueMutationSnapshot({
        knownSongs: context.knownSongs,
        shuffleEnabled: context.shuffleEnabled,
        targets: context.targets,
      });
    } catch (error) {
      if (!(error instanceof NativeQueueReadbackUnstableError) || attempt === 3) {
        const result = failedResult(context.targets, 'snapshot', error);
        return error instanceof NativeQueueReadbackUnstableError
          ? { ...result, nativeStatus: 'readback-unstable' }
          : result;
      }
      await new Promise(resolve => setTimeout(resolve, 50 * attempt));
      if (context.isCancelled()) return cancelledResult(context.targets, 'snapshot');
    }
  }
  return { ...failedResult(context.targets, 'snapshot'), nativeStatus: 'readback-unstable' };
};

const toRecoveredHydrationResult = async ({
  recovery,
  expectation,
  context,
}: {
  recovery: Exclude<Awaited<ReturnType<typeof recoverNativeQueueMutation>>, { status: 'failed' }>;
  expectation: NativeHydrationExpectation;
  context: HydrationExecutionContext;
}): Promise<HydratedNativeQueueResult> => {
  if (context.isCancelled()) return cancelledResult(context.targets, 'commit');
  const fulfillment = evaluateNativeHydrationFulfillment(expectation, recovery.readback);
  const currentSongPersistence = shouldPersistExpectedCurrentSong(expectation, fulfillment.fulfilled)
    ? await persistNativeCurrentSong(recovery.activeSong, context.librarySongs, context.previousPersistedId)
    : { status: 'not-required' as const };
  return {
    nativeStatus: recovery.status,
    verifiedState: 'confirmed',
    queue: recovery.queue,
    baseQueue: recovery.baseQueue,
    activeSong: recovery.activeSong,
    shuffleEnabled: recovery.shuffleEnabled,
    currentSongPersistence,
    recoveryErrors: recovery.diagnostics,
    persistenceError: currentSongPersistence.error,
    planStatus: fulfillment.fulfilled ? 'fulfilled' : 'retry-required',
  };
};

const recoverHydrationMutation = async ({
  error,
  snapshot,
  expectation,
  context,
}: {
  error: unknown;
  snapshot: NativeQueueMutationSnapshot;
  expectation: NativeHydrationExpectation;
  context: HydrationExecutionContext;
}): Promise<HydratedNativeQueueResult> => {
  if (context.isCancelled()) return cancelledResult(context.targets, 'mutation', error);
  const recovery = await recoverNativeQueueMutation({
    originalError: error,
    snapshot,
    knownSongs: context.knownSongs,
    librarySongs: context.librarySongs,
    targets: context.targets,
    preferredBaseQueue: context.plan.hydratedQueue,
    reconciliationShuffleStrategy: { kind: 'confirmed-action', enabled: context.shuffleEnabled },
    persistCurrentSong: false,
  });
  if (context.isCancelled()) return cancelledResult(context.targets, 'readback', error);
  if (recovery.status !== 'failed') return toRecoveredHydrationResult({ recovery, expectation, context });
  const result = { ...failedResult(context.targets, 'readback', error), recoveryErrors: recovery.diagnostics };
  if (classifyNativeQueueRecoveryFailure(recovery.diagnostics) !== 'readback-unstable') return result;
  return retryPostMutationReadback({ expectation, recoveryErrors: recovery.diagnostics, context });
};

const applyNoopHydration = async ({
  snapshot,
  expectation,
  context,
}: {
  snapshot: NativeQueueMutationSnapshot;
  expectation: NativeHydrationExpectation;
  context: HydrationExecutionContext;
}): Promise<HydratedNativeQueueResult> => commitHydrationReadback({
  readback: snapshot,
  nativeStatus: 'noop',
  expectation,
  preferredBaseQueue: snapshot.baseQueue,
  context,
});

const applyHydrationMutation = async ({
  snapshot,
  expectation,
  context,
}: {
  snapshot: NativeQueueMutationSnapshot;
  expectation: NativeHydrationExpectation;
  context: HydrationExecutionContext;
}): Promise<HydratedNativeQueueResult> => {
  try {
    await TrackPlayer.reset();
    if (context.isCancelled()) return cancelledResult(context.targets, 'mutation');
    if (context.plan.playableQueue.length === 0) logEmptyPlayableQueueHydration(context.plan);
    else await TrackPlayer.add(context.plan.playableQueue.map(toTrackPlayerTrack));
    if (context.isCancelled()) return cancelledResult(context.targets, 'mutation');
    return commitHydrationReadback({
      readback: await readNativeQueueTruth(context.knownSongs),
      nativeStatus: 'applied',
      expectation,
      preferredBaseQueue: context.plan.hydratedQueue,
      context,
    });
  } catch (error) {
    return recoverHydrationMutation({ error, snapshot, expectation, context });
  }
};

export const applyHydratedNativeQueue = async ({
  plan,
  nativeQueueRef,
  isCancelled,
  targets = targetsForNativeRef(nativeQueueRef),
  librarySongs = plan.hydratedSongs,
  shuffleEnabled = false,
}: ApplyHydratedNativeQueueArgs): Promise<HydratedNativeQueueResult> => {
  const previousPersistedId = plan.currentSongPersistence.action === 'keep'
    ? plan.resolvedCurrentSongId
    : undefined;
  const guardedTargets = guardNativeQueueTargets(targets, () => !isCancelled());
  const context: HydrationExecutionContext = {
    plan,
    knownSongs: [...librarySongs, ...plan.playableQueue, ...nativeQueueRef.current],
    librarySongs,
    targets: guardedTargets,
    previousPersistedId,
    shuffleEnabled,
    isCancelled,
  };
  try {
    return await runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      if (!isCurrent()) return { ...failedResult(guardedTargets, 'snapshot'), nativeStatus: 'superseded' };
      if (isCancelled()) return cancelledResult(guardedTargets, 'snapshot');
      if (plan.nativeQueueAction === 'clearMalformedCurrent') return clearMalformedNativeCurrent(context);
      const snapshotResult = await createHydrationSnapshot(context);
      if (isHydrationResult(snapshotResult)) return snapshotResult;
      const expectation = createNativeHydrationExpectation(plan, snapshotResult);
      if (isCancelled()) return cancelledResult(guardedTargets, 'snapshot');
      return plan.nativeQueueAction === 'none'
        ? applyNoopHydration({ snapshot: snapshotResult, expectation, context })
        : applyHydrationMutation({ snapshot: snapshotResult, expectation, context });
    });
  } catch (error) {
    return failedResult(guardedTargets, 'exclusive-action', error);
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
