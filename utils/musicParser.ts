/**
 * Formatiert Millisekunden in M:SS.
 */
export const formatTime = (milliseconds: number): string => {
  if (!isFinite(milliseconds) || milliseconds < 0) return '0:00';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Leitet Titel/Künstler aus einem Dateinamen ab (Fallback-Parser).
 * Auf Native ist eine robuste ID3-Extraktion ein Native-Modul-Thema
 * (z.B. react-native-music-library). Dieser Helfer ist nur ein Fallback.
 */
export interface ParsedFilename {
  title: string;
  artist?: string;
}

export const UNKNOWN_TITLE_LABEL = 'Unbekannter Titel';
export const UNKNOWN_ARTIST_LABEL = 'Unbekannt';
export const UNKNOWN_ALBUM_LABEL = 'Unbekanntes Album';

const EMPTY_METADATA_VALUES = new Set(['unknown', 'null', 'undefined', '<unknown>']);

export const decodeMetadataText = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const normalizeMetadataText = (value?: string | null): string | undefined => {
  const normalized = (value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
  if (!normalized || EMPTY_METADATA_VALUES.has(normalized.toLocaleLowerCase('de-DE'))) return undefined;
  return normalized;
};

export const stripAudioExtension = (value: string): string => value.replace(/\.(?:mp3|m4a|mp4|aac|flac|wav|ogg|opus|m4b)$/iu, '');

const basename = (value: string): string => {
  const withoutQuery = value.replace(/[?#].*$/, '').replace(/\/+$/, '');
  return withoutQuery.split('/').filter(Boolean).pop() ?? withoutQuery;
};

export const displayNameFromFilename = (filename?: string | null, uri?: string | null): string | undefined => {
  const raw = normalizeMetadataText(filename) ?? normalizeMetadataText(uri);
  if (!raw) return undefined;
  return normalizeMetadataText(stripAudioExtension(decodeMetadataText(basename(raw))));
};

export const parseFilename = (filename: string): ParsedFilename => {
  const clean = displayNameFromFilename(filename) ?? '';
  const parts = clean.split(/\s*[-–]\s*/).map(part => normalizeMetadataText(part)).filter(Boolean) as string[];
  if (parts.length >= 2) {
    return { artist: parts[0], title: parts.slice(1).join(' - ') };
  }
  return { title: clean };
};

export const resolveDisplayTitle = (title?: string | null, filename?: string | null, uri?: string | null): string =>
  normalizeMetadataText(title) ?? displayNameFromFilename(filename, uri) ?? UNKNOWN_TITLE_LABEL;

export const resolveDisplayArtist = (artist?: string | null): string =>
  normalizeMetadataText(artist) ?? UNKNOWN_ARTIST_LABEL;

export const resolveDisplayAlbum = (album?: string | null): string =>
  normalizeMetadataText(album) ?? UNKNOWN_ALBUM_LABEL;
