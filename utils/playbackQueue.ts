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

export const hasSameSongIdMultiset = (a: Song[], b: Song[]): boolean => {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  a.forEach(song => {
    const id = normalizeSongId(song.id) ?? '';
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });
  return b.every(song => {
    const id = normalizeSongId(song.id) ?? '';
    const next = (counts.get(id) ?? 0) - 1;
    if (next < 0) return false;
    if (next === 0) counts.delete(id);
    else counts.set(id, next);
    return true;
  });
};

export const shuffleQueueKeepingCurrent = (queue: Song[], currentSongId?: string): Song[] => {
  const ordered = moveSongToFront(queue, currentSongId);
  if (ordered.length <= 2) return ordered;
  const [current, ...rest] = ordered;
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return current ? [current, ...rest] : rest;
};

export const hasSameSongIds = hasSameSongIdMultiset;

export const hasSameOrderedSongIds = (a: Song[], b: Song[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((song, index) => normalizeSongId(song.id) === normalizeSongId(b[index]?.id));
};

export const hasSameCircularOrderedSongIds = (a: Song[], b: Song[]): boolean => {
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;
  const bIds = b.map(song => normalizeSongId(song.id));
  return a.some((song, offset) => {
    if (normalizeSongId(song.id) !== bIds[0]) return false;
    return bIds.every((id, index) => normalizeSongId(a[(offset + index) % a.length]?.id) === id);
  });
};
