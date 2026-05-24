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

const uniqueValidSongIds = (songIds: string[], validSongIds?: Set<string>): string[] => {
  const normalizedValidSongIds = normalizeValidSongIds(validSongIds);
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

export const prunePlaylists = (items: Playlist[], validSongIds: Set<string>): Playlist[] => {
  let changed = false;
  const now = Date.now();
  const next = items.map(playlist => {
    const songIds = uniqueValidSongIds(playlist.songIds, validSongIds);
    if (songIds.length !== playlist.songIds.length || songIds.some((songId, index) => songId !== playlist.songIds[index])) changed = true;
    return songIds.length === playlist.songIds.length && songIds.every((songId, index) => songId === playlist.songIds[index])
      ? playlist
      : { ...playlist, songIds, updatedAt: now };
  });
  return changed ? next : items;
};

export const sanitizePlaylists = (items: Playlist[]): Playlist[] => {
  let changed = false;
  const now = Date.now();
  const next = items.map(playlist => {
    const songIds = uniqueValidSongIds(playlist.songIds);
    if (songIds.length !== playlist.songIds.length || songIds.some((songId, index) => songId !== playlist.songIds[index])) changed = true;
    return songIds.length === playlist.songIds.length && songIds.every((songId, index) => songId === playlist.songIds[index])
      ? playlist
      : { ...playlist, songIds, updatedAt: now };
  });
  return changed ? next : items;
};

export const renamePlaylistById = (items: Playlist[], id: string, name: string, now: number = Date.now()): Playlist[] => {
  const playlistId = normalizeId(id);
  if (!playlistId) return items.slice();
  return items.map(playlist => {
    if (normalizeId(playlist.id) !== playlistId || playlist.name === name) return playlist;
    return { ...playlist, name, updatedAt: now };
  });
};

export const addSongToPlaylistById = (
  items: Playlist[],
  playlistId: string,
  songId: string,
  now: number = Date.now(),
): Playlist[] => {
  const targetPlaylistId = normalizeId(playlistId);
  const targetSongId = normalizeId(songId);
  if (!targetPlaylistId || !targetSongId) return items.slice();
  return items.map(playlist => {
    if (normalizeId(playlist.id) !== targetPlaylistId) return playlist;
    const songIds = uniqueValidSongIds([...playlist.songIds, targetSongId]);
    return songIds.length === playlist.songIds.length && songIds.every((id, index) => id === playlist.songIds[index])
      ? playlist
      : { ...playlist, songIds, updatedAt: now };
  });
};

export const removeSongFromPlaylistById = (
  items: Playlist[],
  playlistId: string,
  songId: string,
  now: number = Date.now(),
): Playlist[] => {
  const targetPlaylistId = normalizeId(playlistId);
  const targetSongId = normalizeId(songId);
  if (!targetPlaylistId || !targetSongId) return items.slice();
  return items.map(playlist => {
    if (normalizeId(playlist.id) !== targetPlaylistId) return playlist;
    const songIds = uniqueValidSongIds(playlist.songIds).filter(currentSongId => currentSongId !== targetSongId);
    return songIds.length === playlist.songIds.length && songIds.every((id, index) => id === playlist.songIds[index])
      ? playlist
      : { ...playlist, songIds, updatedAt: now };
  });
};

export const deletePlaylistById = (items: Playlist[], id: string): Playlist[] => {
  const playlistId = normalizeId(id);
  if (!playlistId) return items.slice();
  return items.filter(playlist => normalizeId(playlist.id) !== playlistId);
};
