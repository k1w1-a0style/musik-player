import type { Song } from '../types/Song';

const normalizeSongId = (songId?: string): string | undefined => {
  const trimmed = songId?.trim();
  return trimmed || undefined;
};

const normalizeRotationIndex = (queueLength: number, index: number): number =>
  Number.isInteger(index) && index > 0 && index < queueLength ? index : 0;

export const moveSongToFront = (queue: Song[], songId?: string): Song[] => {
  const normalizedSongId = normalizeSongId(songId);
  if (!normalizedSongId) return queue.slice();
  const idx = queue.findIndex(song => normalizeSongId(song.id) === normalizedSongId);
  return idx >= 0 ? rotateQueueFromIndex(queue, idx) : queue.slice();
};

export const rotateQueueFromIndex = (queue: Song[], index: number): Song[] => {
  const normalizedIndex = normalizeRotationIndex(queue.length, index);
  return normalizedIndex > 0 ? [...queue.slice(normalizedIndex), ...queue.slice(0, normalizedIndex)] : queue.slice();
};

export const shuffleQueueKeepingCurrent = (
  queue: Song[],
  currentSongId?: string,
  random: () => number = Math.random,
): Song[] => {
  const ordered = moveSongToFront(queue, currentSongId);
  if (ordered.length <= 2) return ordered;
  const [current, ...rest] = ordered;
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return current ? [current, ...rest] : rest;
};


export const hasSameOrderedSongIds = (a: Song[], b: Song[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((song, index) => normalizeSongId(song.id) === normalizeSongId(b[index]?.id));
};
