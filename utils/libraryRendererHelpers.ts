import type { Song } from '../types/Song';
import { isDemoSong } from './libraryDemoSongs';
import { buildSongKey, displayAlbum, displayArtist, normalizeLibraryText } from './libraryPresentation';

export const SONG_ROW_HEIGHT = 62;

export const getLibrarySongItemLayout = (
  _: ArrayLike<Song> | null | undefined,
  index: number,
): { length: number; offset: number; index: number } => ({
  length: SONG_ROW_HEIGHT,
  offset: SONG_ROW_HEIGHT * index,
  index,
});

export const buildSongCardSong = (song: Song): Song => ({
  ...song,
  id: normalizeLibraryText(song.id),
  title: normalizeLibraryText(song.title) || 'Unbekannter Titel',
  artist: displayArtist(song),
  album: displayAlbum(song),
});

export const getLibrarySongKey = (song: Song): string => normalizeLibraryText(song.id) || buildSongKey(song);

export const shouldShowTrackInfoAction = (song: Song): boolean => !isDemoSong(song);
