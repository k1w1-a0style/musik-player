import type { MutableRefObject } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { Song } from '../types/Song';
import { runExclusiveNativeQueueReplacement } from '../utils/nativeQueueMutationLock';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';
import type { HydrationPlan } from './musicHydrationPlan';
import {
  buildEmptyPlayableQueueHydrationContext,
  isEmptyPlayableQueueLegitimate,
} from './musicHydrationEmptyQueueLog';

export interface ApplyHydratedNativeQueueArgs {
  plan: HydrationPlan;
  nativeQueueRef: MutableRefObject<Song[]>;
  isCancelled: () => boolean;
}

export const clearNativeQueueAfterMalformedRestoredSong = async (
  nativeQueueRef: MutableRefObject<Song[]>,
): Promise<boolean> => {
  try {
    return await runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      if (!isCurrent()) return false;
      await TrackPlayer.reset();
      nativeQueueRef.current = [];
      return true;
    });
  } catch (error) {
    console.warn('[PlaybackQueue] Failed to reset native queue after dropping malformed restored song.', error);
    return false;
  }
};

export const applyHydratedNativeQueue = async ({
  plan,
  nativeQueueRef,
  isCancelled,
}: ApplyHydratedNativeQueueArgs): Promise<boolean> => {
  if (plan.nativeQueueAction === 'none' || plan.nativeQueueAction === 'clearMalformedCurrent') return true;

  let didResetNativeQueue = false;

  try {
    const applied = await runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      if (isCancelled() || !isCurrent()) return false;
      await TrackPlayer.reset();
      didResetNativeQueue = true;
      nativeQueueRef.current = [];

      if (isCancelled() || !isCurrent()) {
        return false;
      }

      if (plan.playableQueue.length === 0) {
        logEmptyPlayableQueueHydration(plan);
        return true;
      }

      await TrackPlayer.add(plan.playableQueue.map(toTrackPlayerTrack));
      // TrackPlayer.add is not cancellable. Once it resolves, the ref must
      // immediately describe the native queue even if this hydration became
      // obsolete while the bridge call was in flight.
      nativeQueueRef.current = plan.playableQueue.slice();
      if (isCancelled() || !isCurrent()) return false;
      return true;
    });
    return applied;
  } catch (error) {
    if (didResetNativeQueue) nativeQueueRef.current = [];
    console.warn('[PlaybackQueue] Failed to initialize hydrated native queue.', error);
    return false;
  }
};

export const resetNativeQueueAfterHydrationFailure = async (
  nativeQueueRef: MutableRefObject<Song[]>,
): Promise<boolean> => {
  try {
    return await runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      if (!isCurrent()) return false;
      await TrackPlayer.reset();
      nativeQueueRef.current = [];
      return true;
    });
  } catch (resetError) {
    console.warn('[MusicHydration:TrackPlayerError] Failed to reset native queue after hydration failure.', resetError);
    return false;
  }
};

/**
 * Emit a contextualized log when hydration produced no playable songs.
 *
 * A pristine first launch or an intentionally emptied library is legitimate
 * and must not look like an error: only a debug-level info log with counts is
 * emitted. When we do have library songs but none are playable (missing URIs
 * on all rows) we keep the loud warning because that indicates a real problem.
 */
const logEmptyPlayableQueueHydration = (plan: HydrationPlan): void => {
  const context = buildEmptyPlayableQueueHydrationContext(plan);
  if (isEmptyPlayableQueueLegitimate(plan)) {
    // eslint-disable-next-line no-console
    console.info('[PlaybackQueue] Hydration produced no playable songs (empty library / first launch).', context);
    return;
  }
  console.warn('[PlaybackQueue] Hydration produced no playable songs for native queue.', context);
};
