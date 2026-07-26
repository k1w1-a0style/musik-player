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

export type HydratedNativeQueueResult =
  | { status: 'applied' | 'reconciled'; queue: Song[]; activeSong: Song | null; recoveryError?: unknown; persistenceError?: unknown }
  | { status: 'failed'; queue: Song[]; activeSong: Song | null; recoveryError: unknown; readbackError?: unknown };

const normalizedId = (value: unknown): string => String(value ?? '').trim();

const readHydratedQueue = async (knownSongs: Song[]): Promise<{ queue: Song[]; activeSong: Song | null }> => {
  const tracks = await TrackPlayer.getQueue();
  const active = await TrackPlayer.getActiveTrack();
  const queue = tracks.map(track => {
    const song = knownSongs.find(item => normalizedId(item.id) === normalizedId(track.id));
    if (!song) throw new Error(`Hydrated native queue contains unknown track "${String(track.id)}".`);
    return song;
  });
  const activeSong = active
    ? queue.find(song => normalizedId(song.id) === normalizedId(active.id)) ?? null
    : queue[0] ?? null;
  if (active && !activeSong) throw new Error(`Hydrated active track "${String(active.id)}" is unknown.`);
  return { queue, activeSong };
};

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
}: ApplyHydratedNativeQueueArgs): Promise<HydratedNativeQueueResult> => {
  if (plan.nativeQueueAction === 'none' || plan.nativeQueueAction === 'clearMalformedCurrent') {
    return { status: 'applied', queue: nativeQueueRef.current.slice(), activeSong: plan.restoredSong ?? null };
  }

  try {
    return await runExclusiveNativeQueueReplacement(async ({ isCurrent }): Promise<HydratedNativeQueueResult> => {
      try {
      if (isCancelled() || !isCurrent()) {
        return { status: 'failed', queue: nativeQueueRef.current.slice(), activeSong: null,
          recoveryError: new Error('Hydration was cancelled before native mutation.') };
      }
      await TrackPlayer.reset();
      nativeQueueRef.current = [];

      if (isCancelled() || !isCurrent()) {
        return { status: 'failed', queue: [], activeSong: null,
          recoveryError: new Error('Hydration was cancelled after reset.') };
      }

      if (plan.playableQueue.length === 0) {
        logEmptyPlayableQueueHydration(plan);
        return { status: 'applied', queue: [], activeSong: null };
      }

      await TrackPlayer.add(plan.playableQueue.map(toTrackPlayerTrack));
      // TrackPlayer.add is not cancellable. Once it resolves, the ref must
      // immediately describe the native queue even if this hydration became
      // obsolete while the bridge call was in flight.
      nativeQueueRef.current = plan.playableQueue.slice();
      const activeSong = plan.restoredSong
        ?? plan.playableQueue[0]
        ?? null;
      return { status: 'applied', queue: plan.playableQueue.slice(), activeSong };
      } catch (error) {
        try {
          const recovered = await readHydratedQueue([...plan.playableQueue, ...nativeQueueRef.current]);
          nativeQueueRef.current = recovered.queue.slice();
          console.warn('[PlaybackQueue] Failed to initialize hydrated native queue.', error);
          return { status: 'reconciled', ...recovered, recoveryError: error };
        } catch (readbackError) {
          console.warn('[PlaybackQueue] Failed to initialize hydrated native queue.', error);
          return { status: 'failed', queue: nativeQueueRef.current.slice(), activeSong: null,
            recoveryError: error, readbackError };
        }
      }
    });
  } catch (error) {
    console.warn('[PlaybackQueue] Failed to initialize hydrated native queue.', error);
    return { status: 'failed', queue: nativeQueueRef.current.slice(), activeSong: null, recoveryError: error };
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
