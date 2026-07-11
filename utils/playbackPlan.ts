import type { Song } from '../types/Song';
import { asPlayableSong, isPlayableSong, toPlayableSongs, type PlayableSong } from './playableSong';
import { hasSameOrderedSongIds } from './playbackQueue';

export interface PlaySongQueuePlan {
  requestedSong: PlayableSong;
  queueWithRequested: PlayableSong[];
  nativeIndex: number;
  canReuseNativeQueue: boolean;
  reusableOrderedQueue: PlayableSong[];
  rebuildOrderedQueue: PlayableSong[];
}

export interface NormalizePlayableQueueOptions {
  warn?: boolean;
  logger?: Pick<Console, 'warn'>;
}

const getNormalizeLogger = (
  options?: NormalizePlayableQueueOptions,
): Pick<Console, 'warn'> | undefined => {
  if (options?.warn !== true) return undefined;
  return options.logger ?? console;
};

const warnDroppedSong = (
  logger: Pick<Console, 'warn'> | undefined,
  reason: 'blank-id' | 'missing-uri' | 'duplicate-id',
  song: Song,
  normalizedId?: string,
): void => {
  if (!logger) return;
  logger.warn('[normalizePlayableQueue] dropped song', {
    reason,
    songId: normalizedId ?? (song.id?.trim() || undefined),
    title: song.title || undefined,
  });
};

export const normalizePlayableQueue = (
  queue: Song[],
  options?: NormalizePlayableQueueOptions,
): PlayableSong[] => {
  const seenIds = new Set<string>();
  const playable: PlayableSong[] = [];
  const logger = getNormalizeLogger(options);

  for (const song of queue) {
    const id = song.id.trim();
    if (!id) {
      warnDroppedSong(logger, 'blank-id', song);
      continue;
    }

    if (!isPlayableSong(song)) {
      warnDroppedSong(logger, 'missing-uri', song, id);
      continue;
    }

    if (seenIds.has(id)) {
      warnDroppedSong(logger, 'duplicate-id', song, id);
      continue;
    }

    seenIds.add(id);
    const normalizedSong = song.id === id ? song : { ...song, id };
    const playableSong = asPlayableSong(normalizedSong);
    if (!playableSong) {
      warnDroppedSong(logger, 'missing-uri', song, id);
      continue;
    }
    playable.push(playableSong);
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
    (() => {
      const normalizedSong = { ...song, id: normalizedRequestedId };
      return asPlayableSong(normalizedSong) ?? undefined;
    })();
  if (!requestedSong) return null;

  const requestedIndex = contextQueue.findIndex(item => item.id === requestedSong.id);
  const queueWithRequested =
    requestedIndex >= 0 ? contextQueue : [requestedSong, ...contextQueue];
  const playableNativeQueue = normalizePlayableQueue(nativeQueue);
  const nativeIndex = playableNativeQueue.findIndex(item => item.id === requestedSong.id);
  const canReuseNativeQueue =
    nativeIndex >= 0 && hasSameOrderedSongIds(playableNativeQueue, queueWithRequested);

  return {
    requestedSong,
    queueWithRequested,
    nativeIndex,
    canReuseNativeQueue,
    reusableOrderedQueue: canReuseNativeQueue ? toPlayableSongs(queueWithRequested) : [],
    rebuildOrderedQueue: toPlayableSongs(queueWithRequested),
  };
};

export interface ShuffleTogglePlan {
  nextQueue: PlayableSong[];
  nextBaseQueue: PlayableSong[];
  selectedSong?: PlayableSong;
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
  const nextQueue = toPlayableSongs(restoreQueue.slice());

  return {
    nextQueue,
    nextBaseQueue: toPlayableSongs(playableBaseQueue.slice()),
    selectedSong: (normalizedCurrentSongId ? nextQueue.find(song => song.id === normalizedCurrentSongId) : undefined) ?? nextQueue[0],
  };
};
