import { TITLE_FALLBACK_AUDIO_EXTENSIONS } from './audioExtensions';

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

export const stripAudioExtension = (value: string): string => {
  const index = value.lastIndexOf('.');
  if (index <= 0) return value;
  const extension = value.slice(index + 1).toLocaleLowerCase('en-US');
  return TITLE_FALLBACK_AUDIO_EXTENSIONS.has(extension) ? value.slice(0, index) : value;
};

const URI_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//iu;

const isLikelyUri = (value: string): boolean => URI_SCHEME_PATTERN.test(value);

const basename = (value: string): string => {
  const withoutQuery = (isLikelyUri(value) ? value.replace(/[?#].*$/, '') : value).replace(/\/+$/, '');
  const rawBase = withoutQuery.split('/').filter(Boolean).pop() ?? withoutQuery;
  const decoded = decodeMetadataText(rawBase);
  return decoded.split('/').filter(Boolean).pop() ?? decoded;
};

export const displayFilename = (filename?: string | null, uri?: string | null): string | undefined => {
  const raw = normalizeMetadataText(filename) ?? normalizeMetadataText(uri);
  if (!raw) return undefined;
  return normalizeMetadataText(basename(raw));
};

export const displayNameFromFilename = (filename?: string | null, uri?: string | null): string | undefined => {
  const display = displayFilename(filename, uri);
  return display ? normalizeMetadataText(stripAudioExtension(display)) : undefined;
};

const parseFilenameParts = (rawParts: string[]): ParsedFilename | undefined => {
  if (rawParts.length < 2) return undefined;
  const parts = rawParts.map(part => normalizeMetadataText(part));
  const artist = parts[0];
  const title = parts.slice(1).filter(Boolean).join(' - ');
  if (title) return artist ? { artist, title } : { title };
  if (artist) return { artist, title: UNKNOWN_TITLE_LABEL };
  return undefined;
};

const allFilenamePartsArePlaceholders = (rawParts?: string[]): boolean =>
  Boolean(rawParts && rawParts.length >= 2 && rawParts.every(part => !normalizeMetadataText(part)));

const splitCompactArtistTitle = (clean: string): string[] | undefined => {
  const match = clean.match(/^(.+?)[-–](.+)$/u);
  if (!match) return undefined;
  const [, rawArtist, rawTitle] = match;
  const artist = normalizeMetadataText(rawArtist);
  const title = normalizeMetadataText(rawTitle);
  if (!artist || !title) return [rawArtist, rawTitle];
  // Compact separators are ambiguous in ordinary hyphenated titles. Only treat them
  // as artist/title separators when both sides look substantial enough.
  return artist.length >= 3 && title.length >= 3 ? [rawArtist, rawTitle] : undefined;
};

export const parseFilename = (filename: string): ParsedFilename => {
  const clean = displayNameFromFilename(filename) ?? '';
  const spacedParts = clean.split(/\s+[-–]\s+/);
  const spacedResult = parseFilenameParts(spacedParts);
  if (spacedResult) return spacedResult;
  if (allFilenamePartsArePlaceholders(spacedParts)) return { title: UNKNOWN_TITLE_LABEL };

  const compactParts = splitCompactArtistTitle(clean);
  const compactResult = compactParts ? parseFilenameParts(compactParts) : undefined;
  if (compactResult) return compactResult;
  if (allFilenamePartsArePlaceholders(compactParts)) return { title: UNKNOWN_TITLE_LABEL };

  return { title: normalizeMetadataText(clean) ?? UNKNOWN_TITLE_LABEL };
};

const displayTitleFromFilename = (filename?: string | null, uri?: string | null): string | undefined => {
  const display = displayFilename(filename, uri);
  return display ? parseFilename(display).title : undefined;
};

export const resolveDisplayTitle = (title?: string | null, filename?: string | null, uri?: string | null): string =>
  normalizeMetadataText(title) ?? displayTitleFromFilename(filename, uri) ?? UNKNOWN_TITLE_LABEL;

export const resolveDisplayArtist = (artist?: string | null): string =>
  normalizeMetadataText(artist) ?? UNKNOWN_ARTIST_LABEL;

export const resolveDisplayAlbum = (album?: string | null): string =>
  normalizeMetadataText(album) ?? UNKNOWN_ALBUM_LABEL;
