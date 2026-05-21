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

export const normalizePlayableQueue = (queue: Song[]): Song[] => {
  const seenIds = new Set<string>();
  const playable: Song[] = [];
  for (const song of queue) {
    const id = song.id.trim();
    if (!id || !song.uri || seenIds.has(id)) continue;
    seenIds.add(id);
    playable.push(song.id === id ? song : { ...song, id });
  }
  return playable;
};

export const buildPlaySongQueuePlan = (
  song: Song,
  sourceQueue: Song[],
  nativeQueue: Song[],
): PlaySongQueuePlan | null => {
  const contextQueue = normalizePlayableQueue(sourceQueue);
  const normalizedRequestedId = song.id.trim();
  if (!normalizedRequestedId) return null;
  const requestedSong =
    contextQueue.find(item => item.id === normalizedRequestedId) ??
    (song.uri ? { ...song, id: normalizedRequestedId } : undefined);
  if (!requestedSong) return null;

  const requestedIndex = contextQueue.findIndex(item => item.id === requestedSong.id);
  const queueWithRequested =
    requestedIndex >= 0 ? contextQueue : [requestedSong, ...contextQueue];
  const playableNativeQueue = normalizePlayableQueue(nativeQueue);
  const nativeIndex = playableNativeQueue.findIndex(item => item.id === requestedSong.id);
  const canReuseNativeQueue =
    nativeIndex >= 0 && hasSameSongIds(playableNativeQueue, queueWithRequested);

  return {
    requestedSong,
    queueWithRequested,
    nativeIndex,
    canReuseNativeQueue,
    reusableOrderedQueue: canReuseNativeQueue
      ? rotateQueueFromIndex(playableNativeQueue, nativeIndex)
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
  const playableCurrentQueue = normalizePlayableQueue(currentQueue);
  const playableBaseQueue = normalizePlayableQueue(baseQueue);
  const normalizedCurrentSongId = currentSongId?.trim() || undefined;
  if (playableCurrentQueue.length === 0) return null;

  if (!shuffleEnabled) {
    const nextBaseQueue = playableBaseQueue.length === 0 ? playableCurrentQueue.slice() : playableBaseQueue.slice();
    const currentTrack = normalizedCurrentSongId
      ? playableCurrentQueue.find(song => song.id === normalizedCurrentSongId)
      : undefined;
    const rest = playableCurrentQueue.filter(song => song.id !== normalizedCurrentSongId);

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

  const restoreQueue = playableBaseQueue.length > 0 ? playableBaseQueue : playableCurrentQueue;
  const currentIndex = normalizedCurrentSongId
    ? restoreQueue.findIndex(song => song.id === normalizedCurrentSongId)
    : -1;
  const nextQueue = currentIndex >= 0
    ? rotateQueueFromIndex(restoreQueue, currentIndex)
    : restoreQueue.slice();

  return {
    nextQueue,
    nextBaseQueue: playableBaseQueue.slice(),
    selectedSong:
      (normalizedCurrentSongId ? nextQueue.find(song => song.id === normalizedCurrentSongId) : undefined) ??
      nextQueue[0],
  };
};