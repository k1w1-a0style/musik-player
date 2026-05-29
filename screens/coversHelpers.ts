import type { Song } from '../types/Song';
import { getSongArtworkUri } from '../utils/songArtwork';

export interface AlbumGroup {
  name: string;
  songs: Song[];
  artworkUri?: string;
}

export const UNKNOWN_ALBUM = 'Unbekannt';

export const getAlbumGroupName = (song: Song): string => song.album?.trim() || UNKNOWN_ALBUM;

export const buildAlbumGroups = (songs: Song[]): AlbumGroup[] => {
  const grouped = songs.reduce<Record<string, Song[]>>((acc, song) => {
    const key = getAlbumGroupName(song);
    (acc[key] ||= []).push(song);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([name, list]) => ({
      name,
      songs: list,
      artworkUri: list.map(getSongArtworkUri).find(Boolean),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const formatAlbumSongCount = (count: number): string =>
  `${count} ${count === 1 ? 'Titel' : 'Titel'}`;
