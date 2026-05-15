import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { deriveFolderNameFromUri } from './mediaLibraryImport';
import { getSongArtworkUri } from './songArtwork';

export type LibraryGroupKind = 'album' | 'artist' | 'genre';

export type LibraryGroupItem = {
  id: string;
  title: string;
  subtitle: string;
  songs: Song[];
  cover?: string;
};

const basename = (value?: string): string => {
  if (!value) return '';
  const cleaned = value.replace(/\\/g, '/').replace(/\/+$/, '');
  return cleaned.split('/').filter(Boolean).pop() ?? cleaned;
};

const stripExtension = (value: string): string => value.replace(/\.[^.]+$/, '');

export const displayFolderName = (folder: ScanFolder): string =>
  deriveFolderNameFromUri(folder.uri) || folder.name || 'Ordner';

export const cleanPersonLikeLabel = (value?: string): string => {
  const raw = value?.trim();
  if (!raw) return '';
  if (!raw.includes('primary:') && !raw.includes('content://')) return raw;
  return stripExtension(basename(raw)) || raw;
};

export const displayArtist = (song: Pick<Song, 'artist'>): string =>
  cleanPersonLikeLabel(song.artist) || 'Unbekannt';

export const displayAlbum = (song: Pick<Song, 'album'>): string =>
  cleanPersonLikeLabel(song.album) || 'Unbekanntes Album';

export const displayGenre = (song: Pick<Song, 'genre'>): string =>
  cleanPersonLikeLabel(song.genre) || 'Unbekanntes Genre';

export const mergeSongs = (existingSongs: Song[], importedSongs: Song[]): Song[] => {
  const byKey = new Map<string, Song>();
  [...existingSongs, ...importedSongs].forEach(song => {
    const key = song.uri ?? song.id;
    byKey.set(key, { ...byKey.get(key), ...song });
  });
  return Array.from(byKey.values()).sort((a, b) => a.title.localeCompare(b.title));
};

export const groupSongs = (songs: Song[], kind: LibraryGroupKind): LibraryGroupItem[] => {
  const grouped = new Map<string, Song[]>();
  for (const song of songs) {
    const label = kind === 'album' ? displayAlbum(song) : kind === 'artist' ? displayArtist(song) : displayGenre(song);
    grouped.set(label, [...(grouped.get(label) ?? []), song]);
  }

  return Array.from(grouped.entries())
    .map(([title, list]) => ({
      id: `${kind}:${title}`,
      title,
      subtitle: `${list.length} ${list.length === 1 ? 'Track' : 'Tracks'}`,
      cover: getSongArtworkUri(list.find(song => !!getSongArtworkUri(song)) ?? list[0]),
      songs: list.sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
};
