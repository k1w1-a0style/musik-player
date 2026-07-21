import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { deriveFolderNameFromUri } from './mediaLibraryImport';
import { normalizeMetadataText, resolveDisplayAlbum, resolveDisplayArtist, resolveDisplayTitle } from './musicParser';
import { getSongArtworkUri } from './songArtwork';

export type LibraryGroupKind = 'album' | 'artist' | 'genre';

export type LibraryGroupItem = {
  id: string;
  title: string;
  subtitle: string;
  songs: Song[];
  cover?: string;
};

export const UNKNOWN_ARTIST_LABEL = 'Unbekannt';
export const UNKNOWN_ALBUM_LABEL = 'Unbekanntes Album';
export const UNKNOWN_GENRE_LABEL = 'Unbekanntes Genre';
export const UNKNOWN_ARTIST_KEY = 'unknown-artist';
export const UNKNOWN_ALBUM_KEY = 'unknown-album';
export const UNKNOWN_GENRE_KEY = 'unknown-genre';
export const UNKNOWN_SONG_KEY = 'unknown-song';

interface SongWithOptionalAlbumArtist extends Pick<Song, 'album' | 'artist' | 'fileInfo' | 'id' | 'title' | 'uri'> {
  albumArtist?: string;
}

const basename = (value?: string): string => {
  if (!value) return '';
  const cleaned = value.replace(/\/+$/, '');
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

export const normalizeLibraryText = (value?: string | null): string =>
  (value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();

const normalizeLibraryKeyPart = (value: string, unknownKey: string): string => {
  const normalized = normalizeLibraryText(value).toLocaleLowerCase('de-DE');
  return normalized || unknownKey;
};

const normalizeMetadataKeyPart = (value: string, unknownKey: string): string => {
  const normalized = normalizeMetadataText(value)?.toLocaleLowerCase('de-DE');
  return normalized || unknownKey;
};

export const normalizeAlbumName = (value?: string | null): string => normalizeMetadataKeyPart(cleanPersonLikeLabel(value ?? undefined), UNKNOWN_ALBUM_KEY);
export const normalizeArtistName = (value?: string | null): string => normalizeMetadataKeyPart(cleanPersonLikeLabel(value ?? undefined), UNKNOWN_ARTIST_KEY);
export const getDisplayAlbumName = (value?: string | null): string => resolveDisplayAlbum(cleanPersonLikeLabel(value ?? undefined));
export const getDisplayArtistName = (value?: string | null): string => resolveDisplayArtist(cleanPersonLikeLabel(value ?? undefined));
export const buildArtistKey = (value?: string | null): string => `artist:${normalizeArtistName(value)}`;
export const buildAlbumKey = (song: SongWithOptionalAlbumArtist): string => {
  const albumPart = normalizeAlbumName(song.album);
  const albumArtistNorm = normalizeMetadataText(song.albumArtist);
  if (!albumArtistNorm) return `album:${albumPart}`;
  return `album:${albumPart}::${albumArtistNorm.toLocaleLowerCase('de-DE')}`;
};
