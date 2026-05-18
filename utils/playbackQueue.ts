import type { Song } from '../types/Song';

export const moveSongToFront = (queue: Song[], songId?: string): Song[] => {
  if (!songId) return queue.slice();
  const idx = queue.findIndex(song => song.id === songId);
  return idx >= 0 ? [...queue.slice(idx), ...queue.slice(0, idx)] : queue.slice();
};

export const rotateQueueFromIndex = (queue: Song[], index: number): Song[] =>
  index > 0 ? [...queue.slice(index), ...queue.slice(0, index)] : queue.slice();

export const hasSameSongIds = (a: Song[], b: Song[]): boolean => {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  a.forEach(song => counts.set(song.id, (counts.get(song.id) ?? 0) + 1));
  return b.every(song => {
    const next = (counts.get(song.id) ?? 0) - 1;
    if (next < 0) return false;
    if (next === 0) counts.delete(song.id);
    else counts.set(song.id, next);
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
