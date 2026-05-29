import type { Playlist, Song } from '../types/Song';

export const normalizePlaylistName = (value: string): string => value.trim();

export const countValidPlaylistSongs = (playlist: Playlist, songs: Song[]): number => {
  const songIds = new Set(songs.map(song => song.id));
  return playlist.songIds.filter(id => songIds.has(id)).length;
};

export const formatPlaylistSongCount = (count: number): string =>
  `${count} ${count === 1 ? 'Titel' : 'Titel'}`;
