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
): Promise<void> => {
  try {
    await runExclusiveNativeQueueReplacement(async () => {
      await TrackPlayer.reset();
      nativeQueueRef.current = [];
    });
  } catch (error) {
    console.warn('[PlaybackQueue] Failed to reset native queue after dropping malformed restored song.', error);
  }
};

export const applyHydratedNativeQueue = async ({
  plan,
  nativeQueueRef,
  isCancelled,
}: ApplyHydratedNativeQueueArgs): Promise<void> => {
  if (plan.nativeQueueAction === 'none' || plan.nativeQueueAction === 'clearMalformedCurrent') return;

  try {
    await runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      if (isCancelled() || !isCurrent()) return;
      await TrackPlayer.reset();
      nativeQueueRef.current = [];

      if (isCancelled() || !isCurrent()) {
        return;
      }

      if (plan.playableQueue.length === 0) {
        console.warn('[PlaybackQueue] Hydration produced no playable songs for native queue.');
        nativeQueueRef.current = [];
        return;
      }

      try {
        await TrackPlayer.add(plan.playableQueue.map(toTrackPlayerTrack));
        nativeQueueRef.current = plan.playableQueue.slice();
        if (!isCurrent()) return;
      } catch (error) {
        nativeQueueRef.current = [];
        throw error;
      }
    });
  } catch (error) {
    console.warn('[PlaybackQueue] Failed to initialize hydrated native queue.', error);
  }
};

export const resetNativeQueueAfterHydrationFailure = async (): Promise<void> => {
  try {
    await TrackPlayer.reset();
  } catch (resetError) {
    console.warn('[MusicHydration:TrackPlayerError] Failed to reset native queue after hydration failure.', resetError);
  }
};
