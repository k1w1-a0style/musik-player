import type { Song } from '../types/Song';

export type PlayableSong = Song & { uri: string };

const normalizeUri = (uri: Song['uri']): string | null => {
  if (typeof uri !== 'string') return null;
  const trimmed = uri.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const isPlayableSong = (song: Song): song is PlayableSong => normalizeUri(song.uri) !== null;

export const asPlayableSong = (song: Song): PlayableSong | null => {
  const uri = normalizeUri(song.uri);
  if (!uri) return null;
  if (song.uri === uri) return song as PlayableSong;
  return { ...song, uri };
};

export const toPlayableSongs = (songs: Song[]): PlayableSong[] => songs.flatMap(song => {
  const playable = asPlayableSong(song);
  return playable ? [playable] : [];
});
