import type { Playlist } from '../types/Song';

export const prunePlaylists = (items: Playlist[], validSongIds: Set<string>): Playlist[] => {
  let changed = false;
  const next = items.map(playlist => {
    const songIds = playlist.songIds.filter(songId => validSongIds.has(songId));
    if (songIds.length !== playlist.songIds.length) changed = true;
    return songIds.length === playlist.songIds.length ? playlist : { ...playlist, songIds };
  });
  return changed ? next : items;
};

export const renamePlaylistById = (items: Playlist[], id: string, name: string): Playlist[] =>
  items.map(playlist => (playlist.id === id ? { ...playlist, name } : playlist));

export const addSongToPlaylistById = (
  items: Playlist[],
  playlistId: string,
  songId: string,
): Playlist[] =>
  items.map(playlist =>
    playlist.id === playlistId && !playlist.songIds.includes(songId)
      ? { ...playlist, songIds: [...playlist.songIds, songId] }
      : playlist,
  );

export const removeSongFromPlaylistById = (
  items: Playlist[],
  playlistId: string,
  songId: string,
): Playlist[] =>
  items.map(playlist =>
    playlist.id === playlistId
      ? { ...playlist, songIds: playlist.songIds.filter(currentSongId => currentSongId !== songId) }
      : playlist,
  );

export const deletePlaylistById = (items: Playlist[], id: string): Playlist[] =>
  items.filter(playlist => playlist.id !== id);
