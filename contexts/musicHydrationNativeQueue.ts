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
  nativeStatus: 'failed' | 'stale';
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
      if (!isCurrent() || isCancelled()) return { ...failedResult(targets, 'snapshot'), nativeStatus: 'stale' };
      let snapshot: NativeQueueMutationSnapshot;
      try {
        snapshot = await createNativeQueueMutationSnapshot({ knownSongs, shuffleEnabled, targets });
      } catch (error) {
        const result = failedResult(targets, 'snapshot', error);
        return error instanceof NativeQueueReadbackUnstableError ? { ...result, nativeStatus: 'stale' } : result;
      }
      if (isCancelled()) return { ...failedResult(targets, 'snapshot'), nativeStatus: 'stale' };
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
        if (plan.playableQueue.length === 0 || plan.nativeQueueAction === 'clearMalformedCurrent') {
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
