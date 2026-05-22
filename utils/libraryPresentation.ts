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

const decodeUriSafely = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizedSongUriKey = (song: Song): string | null => {
  const rawUri = song.fileInfo?.uri ?? song.uri;
  if (!rawUri) return null;
  const normalized = decodeUriSafely(rawUri)
    .trim()
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/^file:\/\/+/i, '')
    .replace(/^content:\/\/+/i, '')
    .replace(/\?.*$/, '')
    .replace(/#+.*$/, '')
    .replace(/\/+/g, '/')
    .replace(/\/+$/, '');
  return normalized || null;
};

const normalizedSongFingerprintKey = (song: Song): string | null => {
  const rawFilename = song.fileInfo?.filename ?? basename(song.fileInfo?.uri ?? song.uri);
  const filename = decodeUriSafely(rawFilename).trim().toLowerCase();
  const size = song.fileInfo?.size;
  const duration = song.duration ?? '';
  if (!filename || typeof size !== 'number') return null;
  return `file:${filename}:${size}:${duration}`;
};

const mergeSongKeys = (song: Song): string[] => [
  normalizedSongUriKey(song),
  normalizedSongFingerprintKey(song),
  song.id ? `id:${song.id}` : null,
].filter((key): key is string => !!key);

const byTitle = (a: Song, b: Song): number => a.title.localeCompare(b.title);

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
    const keys = mergeSongKeys(song);
    const canonicalKey = keys.find(key => byKey.has(key)) ?? keys[0] ?? `id:${song.id}`;
    const previousSong = byKey.get(canonicalKey);
    const mergedSong = { ...previousSong, ...song };

    if (previousSong) {
      byKey.forEach((value, key) => {
        if (value === previousSong) byKey.set(key, mergedSong);
      });
    }
    keys.forEach(key => byKey.set(key, mergedSong));
  });

  return Array.from(new Set(byKey.values())).sort(byTitle);
};

export const groupSongs = (songs: Song[], kind: LibraryGroupKind): LibraryGroupItem[] => {
  const grouped = new Map<string, Song[]>();
  for (const song of songs) {
    const label = kind === 'album' ? displayAlbum(song) : kind === 'artist' ? displayArtist(song) : displayGenre(song);
    grouped.set(label, [...(grouped.get(label) ?? []), song]);
  }

  return Array.from(grouped.entries())
    .map(([title, list]) => {
      const sortedSongs = [...list].sort(byTitle);
      return {
        id: `${kind}:${title}`,
        title,
        subtitle: `${sortedSongs.length} ${sortedSongs.length === 1 ? 'Track' : 'Tracks'}`,
        cover: getSongArtworkUri(sortedSongs.find(song => !!getSongArtworkUri(song)) ?? sortedSongs[0]),
        songs: sortedSongs,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
};