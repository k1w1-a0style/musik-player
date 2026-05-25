import type { Playlist } from '../types/Song';

const normalizeId = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed || undefined;
};

const normalizeValidSongIds = (validSongIds?: Set<string>): Set<string> | undefined => {
  if (!validSongIds) return undefined;
  const normalized = new Set<string>();
  validSongIds.forEach(songId => {
    const id = normalizeId(songId);
    if (id) normalized.add(id);
  });
  return normalized;
};

const uniqueValidSongIds = (songIds: string[], normalizedValidSongIds?: Set<string>): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  songIds.forEach(songId => {
    const id = normalizeId(songId);
    if (!id) return;
    if (normalizedValidSongIds && !normalizedValidSongIds.has(id)) return;
    if (seen.has(id)) return;
    seen.add(id);
    result.push(id);
  });
  return result;
};

const sameSongIds = (a: string[], b: string[]): boolean => a.length === b.length && a.every((songId, index) => songId === b[index]);

export const prunePlaylists = (items: Playlist[], validSongIds: Set<string>): Playlist[] => {
  if (items.length === 0) return items;
  const normalizedValidSongIds = normalizeValidSongIds(validSongIds);
  let changed = false;
  let timestamp: number | undefined;
  const next = items.map(playlist => {
    const songIds = uniqueValidSongIds(playlist.songIds, normalizedValidSongIds);
    if (sameSongIds(songIds, playlist.songIds)) return playlist;
    changed = true;
    timestamp ??= Date.now();
    return { ...playlist, songIds, updatedAt: timestamp };
  });
  return changed ? next : items;
};

export const sanitizePlaylists = (items: Playlist[]): Playlist[] => {
  let changed = false;
  let timestamp: number | undefined;
  const next = items.map(playlist => {
    const songIds = uniqueValidSongIds(playlist.songIds);
    if (sameSongIds(songIds, playlist.songIds)) return playlist;
    changed = true;
    timestamp ??= Date.now();
    return { ...playlist, songIds, updatedAt: timestamp };
  });
  return changed ? next : items;
};

export const renamePlaylistById = (items: Playlist[], id: string, name: string, now?: number): Playlist[] => {
  const playlistId = normalizeId(id);
  if (!playlistId) return items;
  let changed = false;
  let timestamp: number | undefined;
  const next = items.map(playlist => {
    if (normalizeId(playlist.id) !== playlistId || playlist.name === name) return playlist;
    changed = true;
    timestamp ??= now ?? Date.now();
    return { ...playlist, name, updatedAt: timestamp };
  });
  return changed ? next : items;
};

export const addSongToPlaylistById = (
  items: Playlist[],
  playlistId: string,
  songId: string,
  now?: number,
): Playlist[] => {
  const targetPlaylistId = normalizeId(playlistId);
  const targetSongId = normalizeId(songId);
  if (!targetPlaylistId || !targetSongId) return items;
  let changed = false;
  let timestamp: number | undefined;
  const next = items.map(playlist => {
    if (normalizeId(playlist.id) !== targetPlaylistId) return playlist;
    const songIds = uniqueValidSongIds([...playlist.songIds, targetSongId]);
    if (songIds.length === playlist.songIds.length && songIds.every((id, index) => id === playlist.songIds[index])) return playlist;
    changed = true;
    timestamp ??= now ?? Date.now();
    return { ...playlist, songIds, updatedAt: timestamp };
  });
  return changed ? next : items;
};

export const removeSongFromPlaylistById = (
  items: Playlist[],
  playlistId: string,
  songId: string,
  now?: number,
): Playlist[] => {
  const targetPlaylistId = normalizeId(playlistId);
  const targetSongId = normalizeId(songId);
  if (!targetPlaylistId || !targetSongId) return items;
  let changed = false;
  let timestamp: number | undefined;
  const next = items.map(playlist => {
    if (normalizeId(playlist.id) !== targetPlaylistId) return playlist;
    const songIds = uniqueValidSongIds(playlist.songIds).filter(currentSongId => currentSongId !== targetSongId);
    if (songIds.length === playlist.songIds.length && songIds.every((id, index) => id === playlist.songIds[index])) return playlist;
    changed = true;
    timestamp ??= now ?? Date.now();
    return { ...playlist, songIds, updatedAt: timestamp };
  });
  return changed ? next : items;
};

export const deletePlaylistById = (items: Playlist[], id: string): Playlist[] => {
  const playlistId = normalizeId(id);
  if (!playlistId) return items;
  const next = items.filter(playlist => normalizeId(playlist.id) !== playlistId);
  return next.length === items.length ? items : next;
};
