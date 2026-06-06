import type { MutableRefObject } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { Song } from '../types/Song';
import { runExclusiveNativeQueueReplacement } from '../utils/nativeQueueMutationLock';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';
import type { HydrationPlan } from './musicHydrationPlan';

export interface ApplyHydratedNativeQueueArgs {
  plan: HydrationPlan;
  nativeQueueRef: MutableRefObject<Song[]>;
  isCancelled: () => boolean;
}

export const clearNativeQueueAfterMalformedRestoredSong = async (
  nativeQueueRef: MutableRefObject<Song[]>,
): Promise<boolean> => {
  try {
    await runExclusiveNativeQueueReplacement(async () => {
      await TrackPlayer.reset();
      nativeQueueRef.current = [];
    });
    return true;
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

  try {
    const applied = await runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      if (isCancelled() || !isCurrent()) return false;
      await TrackPlayer.reset();

      if (isCancelled() || !isCurrent()) {
        nativeQueueRef.current = [];
        return false;
      }

      if (plan.playableQueue.length === 0) {
        console.warn('[PlaybackQueue] Hydration produced no playable songs for native queue.');
        nativeQueueRef.current = [];
        return true;
      }

      await TrackPlayer.add(plan.playableQueue.map(toTrackPlayerTrack));
      nativeQueueRef.current = plan.playableQueue.slice();
      return true;
    });
    return applied;
  } catch (error) {
    console.warn('[PlaybackQueue] Failed to initialize hydrated native queue.', error);
    return false;
  }
};

export const resetNativeQueueAfterHydrationFailure = async (): Promise<void> => {
  try {
    await TrackPlayer.reset();
  } catch (resetError) {
    console.warn('[MusicHydration:TrackPlayerError] Failed to reset native queue after hydration failure.', resetError);
  }
};
