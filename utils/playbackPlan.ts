import type { Song } from '../types/Song';
import { hasSameSongIds, rotateQueueFromIndex } from './playbackQueue';

export interface PlaySongQueuePlan {
  requestedSong: Song;
  queueWithRequested: Song[];
  nativeIndex: number;
  canReuseNativeQueue: boolean;
  reusableOrderedQueue: Song[];
  rebuildOrderedQueue: Song[];
}

export const buildPlaySongQueuePlan = (
  song: Song,
  sourceQueue: Song[],
  nativeQueue: Song[],
): PlaySongQueuePlan | null => {
  const contextQueue = sourceQueue.filter(item => !!item.uri);
  const requestedSong =
    contextQueue.find(item => item.id === song.id) ?? (song.uri ? song : undefined);
  if (!requestedSong) return null;

  const requestedIndex = contextQueue.findIndex(item => item.id === requestedSong.id);
  const queueWithRequested =
    requestedIndex >= 0 ? contextQueue : [requestedSong, ...contextQueue];
  const nativeIndex = nativeQueue.findIndex(item => item.id === requestedSong.id);
  const canReuseNativeQueue =
    nativeIndex >= 0 && hasSameSongIds(nativeQueue, queueWithRequested);

  return {
    requestedSong,
    queueWithRequested,
    nativeIndex,
    canReuseNativeQueue,
    reusableOrderedQueue: canReuseNativeQueue
      ? rotateQueueFromIndex(nativeQueue, nativeIndex)
      : [],
    rebuildOrderedQueue: rotateQueueFromIndex(
      queueWithRequested,
      requestedIndex >= 0 ? requestedIndex : 0,
    ),
  };
};

export interface ShuffleTogglePlan {
  nextQueue: Song[];
  nextBaseQueue: Song[];
  selectedSong?: Song;
}

export const buildShuffleTogglePlan = ({
  currentQueue,
  baseQueue,
  currentSongId,
  shuffleEnabled,
  random = Math.random,
}: {
  currentQueue: Song[];
  baseQueue: Song[];
  currentSongId?: string;
  shuffleEnabled: boolean;
  random?: () => number;
}): ShuffleTogglePlan | null => {
  if (currentQueue.length === 0) return null;

  if (!shuffleEnabled) {
    const nextBaseQueue = baseQueue.length === 0 ? currentQueue.slice() : baseQueue.slice();
    const currentTrack = currentSongId
      ? currentQueue.find(song => song.id === currentSongId)
      : undefined;
    const rest = currentQueue.filter(song => song.id !== currentSongId);

    for (let i = rest.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }

    const nextQueue = currentTrack ? [currentTrack, ...rest] : rest;
    return {
      nextQueue,
      nextBaseQueue,
      selectedSong: nextQueue[0],
    };
  }

  const restoreQueue = baseQueue.length > 0 ? baseQueue : currentQueue;
  const nextQueue = currentSongId
    ? rotateQueueFromIndex(
        restoreQueue,
        Math.max(0, restoreQueue.findIndex(song => song.id === currentSongId)),
      )
    : restoreQueue.slice();

  return {
    nextQueue,
    nextBaseQueue: baseQueue.slice(),
    selectedSong:
      (currentSongId ? nextQueue.find(song => song.id === currentSongId) : undefined) ??
      nextQueue[0],
  };
};
