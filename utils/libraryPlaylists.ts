import type { Playlist, Song } from '../types/Song';
import { displayAlbum, displayArtist, displayGenre } from './libraryPresentation';

export type LibraryPlaylistItem = {
  id: string;
  name: string;
  songs: Song[];
  validCount: number;
  totalCount: number;
};

const searchableSongText = (song: Song): string =>
  [song.title, displayArtist(song), displayAlbum(song), displayGenre(song)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export const buildLibraryPlaylistItems = (
  playlists: Playlist[],
  songs: Song[],
  query = '',
): LibraryPlaylistItem[] => {
  const songsById = new Map(songs.map(song => [song.id, song]));
  const q = query.trim().toLowerCase();

  return playlists
    .map(playlist => {
      const playlistSongs = playlist.songIds
        .map(songId => songsById.get(songId))
        .filter((song): song is Song => !!song);
      return {
        id: playlist.id,
        name: playlist.name,
        songs: playlistSongs,
        validCount: playlistSongs.length,
        totalCount: playlist.songIds.length,
      };
    })
    .filter(item =>
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.songs.some(song => searchableSongText(song).includes(q)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
};
