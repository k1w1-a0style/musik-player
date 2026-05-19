import type { Song } from '../types/Song';
import { isDemoSong } from './libraryDemoSongs';
import { displayAlbum, displayArtist } from './libraryPresentation';

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
  artist: displayArtist(song),
  album: displayAlbum(song),
});

export const shouldShowTrackInfoAction = (song: Song): boolean => !isDemoSong(song);
