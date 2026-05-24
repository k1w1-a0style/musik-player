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

export const renamePlaylistById = (items: Playlist[], id: string, name: string, now?: number): Playlist[] => {
  const playlistId = normalizeId(id);
  if (!playlistId) return items;
  const targetIndex = items.findIndex(playlist => normalizeId(playlist.id) === playlistId);
  if (targetIndex === -1 || items[targetIndex].name === name) return items;
  const timestamp = now ?? Date.now();
  return items.map((playlist, index) => (index === targetIndex ? { ...playlist, name, updatedAt: timestamp } : playlist));
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
  const targetIndex = items.findIndex(playlist => normalizeId(playlist.id) === targetPlaylistId);
  if (targetIndex === -1) return items;
  const targetPlaylist = items[targetIndex];
  const songIds = uniqueValidSongIds([...targetPlaylist.songIds, targetSongId]);
  if (songIds.length === targetPlaylist.songIds.length && songIds.every((id, index) => id === targetPlaylist.songIds[index])) return items;
  const timestamp = now ?? Date.now();
  return items.map((playlist, index) => (index === targetIndex ? { ...playlist, songIds, updatedAt: timestamp } : playlist));
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
  const targetIndex = items.findIndex(playlist => normalizeId(playlist.id) === targetPlaylistId);
  if (targetIndex === -1) return items;
  const targetPlaylist = items[targetIndex];
  const songIds = uniqueValidSongIds(targetPlaylist.songIds).filter(currentSongId => currentSongId !== targetSongId);
  if (songIds.length === targetPlaylist.songIds.length && songIds.every((id, index) => id === targetPlaylist.songIds[index])) return items;
  const timestamp = now ?? Date.now();
  return items.map((playlist, index) => (index === targetIndex ? { ...playlist, songIds, updatedAt: timestamp } : playlist));
};

export const deletePlaylistById = (items: Playlist[], id: string): Playlist[] => {
  const playlistId = normalizeId(id);
  if (!playlistId) return items;
  const next = items.filter(playlist => normalizeId(playlist.id) !== playlistId);
  return next.length === items.length ? items : next;
};
