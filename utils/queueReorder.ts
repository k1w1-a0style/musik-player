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
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)
    || fromIndex < 0 || toIndex < 0 || fromIndex >= queue.length || toIndex >= queue.length) return null;
  const selectedSong = queue[currentIndex];
  const nextQueue = moveArrayItem(queue, fromIndex, toIndex);
  const nextCurrentIndex = currentIndex < 0 ? -1 : currentIndex === fromIndex ? toIndex
    : fromIndex < currentIndex && toIndex >= currentIndex ? currentIndex - 1
      : fromIndex > currentIndex && toIndex <= currentIndex ? currentIndex + 1 : currentIndex;
  return {
    queue: nextQueue,
    fromIndex,
    toIndex,
    currentIndex: nextCurrentIndex,
    selectedSong,
    changed: fromIndex !== toIndex,
  };
};
