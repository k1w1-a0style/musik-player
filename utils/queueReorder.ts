import type { Song } from '../types/Song';

export interface QueueReorderPlan {
  queue: Song[];
  fromIndex: number;
  toIndex: number;
  currentIndex: number;
  selectedSong?: Song;
  changed: boolean;
}

const normalizeSongId = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

export const moveArrayItem = <T,>(items: readonly T[], fromIndex: number, toIndex: number): T[] => {
  const next = items.slice();
  if (
    fromIndex < 0
    || toIndex < 0
    || fromIndex >= next.length
    || toIndex >= next.length
    || fromIndex === toIndex
  ) {
    return next;
  }
  const [item] = next.splice(fromIndex, 1);
  if (item === undefined) return items.slice();
  next.splice(toIndex, 0, item);
  return next;
};

export const buildQueueReorderPlan = ({
  queue,
  fromIndex,
  toIndex,
  currentSongId,
}: {
  queue: Song[];
  fromIndex: number;
  toIndex: number;
  currentSongId?: string;
}): QueueReorderPlan | null => {
  if (queue.length <= 1) return null;
  const normalizedCurrentSongId = normalizeSongId(currentSongId);
  const currentIndex = normalizedCurrentSongId
    ? queue.findIndex(song => normalizeSongId(song.id) === normalizedCurrentSongId)
    : 0;
  const lockIndex = currentIndex >= 0 ? currentIndex : 0;

  const safeFrom = Math.floor(fromIndex);
  const safeToRaw = Math.floor(toIndex);
  if (safeFrom <= lockIndex || safeFrom >= queue.length) return null;

  const minTarget = lockIndex + 1;
  const maxTarget = queue.length - 1;
  const safeTo = Math.max(minTarget, Math.min(maxTarget, safeToRaw));
  if (safeFrom === safeTo) return {
    queue: queue.slice(),
    fromIndex: safeFrom,
    toIndex: safeTo,
    currentIndex: lockIndex,
    selectedSong: queue[lockIndex],
    changed: false,
  };

  const nextQueue = moveArrayItem(queue, safeFrom, safeTo);
  return {
    queue: nextQueue,
    fromIndex: safeFrom,
    toIndex: safeTo,
    currentIndex: lockIndex,
    selectedSong: nextQueue[lockIndex],
    changed: true,
  };
};
