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

export const normalizeLibraryText = (value?: string | null): string => normalizeMetadataText(value) ?? '';

const normalizeLibraryKeyPart = (value: string, unknownKey: string): string => {
  const normalized = normalizeLibraryText(value).toLocaleLowerCase('de-DE');
  return normalized || unknownKey;
};

export const normalizeAlbumName = (value?: string | null): string => normalizeLibraryKeyPart(cleanPersonLikeLabel(value ?? undefined), UNKNOWN_ALBUM_KEY);
export const normalizeArtistName = (value?: string | null): string => normalizeLibraryKeyPart(cleanPersonLikeLabel(value ?? undefined), UNKNOWN_ARTIST_KEY);
export const getDisplayAlbumName = (value?: string | null): string => resolveDisplayAlbum(cleanPersonLikeLabel(value ?? undefined));
export const getDisplayArtistName = (value?: string | null): string => resolveDisplayArtist(cleanPersonLikeLabel(value ?? undefined));
export const buildArtistKey = (value?: string | null): string => `artist:${normalizeArtistName(value)}`;
export const buildAlbumKey = (song: SongWithOptionalAlbumArtist): string => `album:${normalizeAlbumName(song.album)}`;

const normalizedSongUriKey = (song: Song): string | null => {
  const rawUri = song.fileInfo?.uri ?? song.uri;
  if (!rawUri) return null;
  const normalized = decodeUriSafely(rawUri)
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\/+/i, '')
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

export const buildSongKey = (song: Pick<Song, 'id' | 'title' | 'artist' | 'uri' | 'fileInfo' | 'duration'>): string => {
  const id = normalizeLibraryText(song.id);
  if (id) return `song:${id}`;
  const rawUri = song.fileInfo?.uri ?? song.uri;
  if (rawUri) {
    const normalizedUri = decodeUriSafely(rawUri).trim().toLocaleLowerCase('de-DE').replace(/\?.*$/, '').replace(/#+.*$/, '');
    if (normalizedUri) return `song-uri:${normalizedUri}`;
  }
  const titleKey = normalizeLibraryKeyPart(song.title, UNKNOWN_SONG_KEY);
  const artistKey = normalizeArtistName(song.artist);
  const durationKey = Number.isFinite(song.duration) ? String(song.duration) : 'unknown-duration';
  return `song-meta:${artistKey}:${titleKey}:${durationKey}`;
};

const hasNonEmptyText = (value?: string | null): value is string => Boolean(value?.trim());
const hasUsableNumber = (value?: number | null): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const hasUsableArtwork = (song?: Pick<Song, 'cover' | 'coverInfo'> | null): boolean => Boolean(getSongArtworkUri(song));
const preferText = (incoming?: string, previous?: string): string | undefined => hasNonEmptyText(incoming) ? incoming : previous;
const preferNumber = (incoming?: number, previous?: number): number | undefined => hasUsableNumber(incoming) ? incoming : previous;

export const mergeSongPreservingRichMetadata = (previousSong: Song | undefined, incomingSong: Song): Song => {
  if (!previousSong) return incomingSong;
  const merged: Song = {
    ...previousSong,
    ...incomingSong,
    album: preferText(incomingSong.album, previousSong.album),
    albumArtist: preferText(incomingSong.albumArtist, previousSong.albumArtist),
    genre: preferText(incomingSong.genre, previousSong.genre),
    year: preferText(incomingSong.year, previousSong.year),
    trackNumber: preferText(incomingSong.trackNumber, previousSong.trackNumber),
    discNumber: preferText(incomingSong.discNumber, previousSong.discNumber),
    duration: preferNumber(incomingSong.duration, previousSong.duration),
    fileInfo: {
      ...previousSong.fileInfo,
      ...incomingSong.fileInfo,
      uri: preferText(incomingSong.fileInfo?.uri, previousSong.fileInfo?.uri),
      filename: preferText(incomingSong.fileInfo?.filename, previousSong.fileInfo?.filename),
      size: preferNumber(incomingSong.fileInfo?.size, previousSong.fileInfo?.size),
      source: preferText(incomingSong.fileInfo?.source, previousSong.fileInfo?.source),
      importedAt: preferNumber(incomingSong.fileInfo?.importedAt, previousSong.fileInfo?.importedAt),
    },
    audioInfo: {
      ...previousSong.audioInfo,
      ...incomingSong.audioInfo,
      bitrate: preferNumber(incomingSong.audioInfo?.bitrate, previousSong.audioInfo?.bitrate),
      sampleRate: preferNumber(incomingSong.audioInfo?.sampleRate, previousSong.audioInfo?.sampleRate),
      channels: preferNumber(incomingSong.audioInfo?.channels, previousSong.audioInfo?.channels),
    },
  };
  if (!hasUsableArtwork(incomingSong) && hasUsableArtwork(previousSong)) {
    merged.cover = previousSong.cover;
    merged.coverInfo = previousSong.coverInfo;
  }
  if (!previousSong.fileInfo && !incomingSong.fileInfo) delete merged.fileInfo;
  if (!previousSong.audioInfo && !incomingSong.audioInfo) delete merged.audioInfo;
  return merged;
};

const mergeSongKeys = (song: Song): string[] => [normalizedSongUriKey(song), normalizedSongFingerprintKey(song), song.id ? `id:${song.id}` : null].filter((key): key is string => !!key);
const safeTitle = (song: Pick<Song, 'title' | 'fileInfo' | 'uri'>): string => displayTitle(song);
const byTitle = (a: Song, b: Song): number => safeTitle(a).localeCompare(safeTitle(b), 'de-DE', { sensitivity: 'base' }) || buildSongKey(a).localeCompare(buildSongKey(b));
const byGroupTitle = (a: LibraryGroupItem, b: LibraryGroupItem): number => a.title.localeCompare(b.title, 'de-DE', { sensitivity: 'base' }) || a.id.localeCompare(b.id);

export const displayFolderName = (folder: ScanFolder): string => deriveFolderNameFromUri(folder.uri) || folder.name || 'Ordner';

export const cleanPersonLikeLabel = (value?: string): string => {
  const raw = value?.trim();
  if (!raw) return '';
  if (!raw.includes('primary:') && !raw.includes('://')) return raw;
  return stripExtension(basename(raw)) || raw;
};

export const displayTitle = (song: Pick<Song, 'title' | 'fileInfo' | 'uri'>): string =>
  resolveDisplayTitle(song.title, song.fileInfo?.filename, song.fileInfo?.uri ?? song.uri);
export const displayArtist = (song: Pick<Song, 'artist'>): string => getDisplayArtistName(song.artist);
export const displayAlbum = (song: Pick<Song, 'album'>): string => getDisplayAlbumName(song.album);
export const displayGenre = (song: Pick<Song, 'genre'>): string => normalizeLibraryText(cleanPersonLikeLabel(song.genre)) || UNKNOWN_GENRE_LABEL;

export const mergeSongs = (existingSongs: Song[], importedSongs: Song[]): Song[] => {
  const byKey = new Map<string, Song>();
  [...existingSongs, ...importedSongs].forEach(song => {
    const keys = mergeSongKeys(song);
    const canonicalKey = keys.find(key => byKey.has(key)) ?? keys[0] ?? buildSongKey(song);
    const previousSong = byKey.get(canonicalKey);
    const mergedSong = mergeSongPreservingRichMetadata(previousSong, song);
    if (previousSong) {
      byKey.forEach((value, key) => {
        if (value === previousSong) byKey.set(key, mergedSong);
      });
    }
    keys.forEach(key => byKey.set(key, mergedSong));
  });
  return Array.from(new Set(byKey.values())).sort(byTitle);
};

const buildAlbumArtistSummary = (sortedSongs: Song[]): string => {
  const artists = Array.from(new Set(sortedSongs.map(displayArtist).filter(artist => artist !== UNKNOWN_ARTIST_LABEL)));
  if (artists.length === 0) return UNKNOWN_ARTIST_LABEL;
  if (artists.length <= 2) return artists.join(', ');
  return `${artists.slice(0, 2).join(', ')} + ${artists.length - 2}`;
};

const buildGroupSubtitle = (kind: LibraryGroupKind, sortedSongs: Song[]): string => {
  const trackCount = `${sortedSongs.length} Titel`;
  return kind === 'album' ? `${buildAlbumArtistSummary(sortedSongs)} • ${trackCount}` : trackCount;
};

const groupsFromMap = (kind: LibraryGroupKind, grouped: Map<string, Song[]>, titles: Map<string, string>): LibraryGroupItem[] =>
  Array.from(grouped.entries()).map(([id, list]) => {
    const sortedSongs = [...list].sort(byTitle);
    const title = titles.get(id) ?? (kind === 'album' ? UNKNOWN_ALBUM_LABEL : kind === 'artist' ? UNKNOWN_ARTIST_LABEL : UNKNOWN_GENRE_LABEL);
    return {
      id,
      title,
      subtitle: buildGroupSubtitle(kind, sortedSongs),
      cover: getSongArtworkUri(sortedSongs.find(song => !!getSongArtworkUri(song)) ?? sortedSongs[0]),
      songs: sortedSongs,
    };
  }).sort(byGroupTitle);

export const groupSongs = (songs: Song[], kind: LibraryGroupKind): LibraryGroupItem[] => {
  const grouped = new Map<string, Song[]>();
  const titles = new Map<string, string>();
  for (const song of songs) {
    const key = kind === 'album' ? buildAlbumKey(song) : kind === 'artist' ? buildArtistKey(song.artist) : `genre:${normalizeLibraryKeyPart(displayGenre(song), UNKNOWN_GENRE_KEY)}`;
    const title = kind === 'album' ? displayAlbum(song) : kind === 'artist' ? displayArtist(song) : displayGenre(song);
    titles.set(key, titles.get(key) ?? title);
    const existing = grouped.get(key);
    if (existing) existing.push(song);
    else grouped.set(key, [song]);
  }
  return groupsFromMap(kind, grouped, titles);
};

export const buildLibraryGroups = (songs: Song[]): { albumGroups: LibraryGroupItem[]; artistGroups: LibraryGroupItem[]; genreGroups: LibraryGroupItem[] } => {
  const albums = new Map<string, Song[]>();
  const artists = new Map<string, Song[]>();
  const genres = new Map<string, Song[]>();
  const albumTitles = new Map<string, string>();
  const artistTitles = new Map<string, string>();
  const genreTitles = new Map<string, string>();
  for (const song of songs) {
    const albumKey = buildAlbumKey(song);
    const artistKey = buildArtistKey(song.artist);
    const genreLabel = displayGenre(song);
    const genreKey = `genre:${normalizeLibraryKeyPart(genreLabel, UNKNOWN_GENRE_KEY)}`;
    albumTitles.set(albumKey, albumTitles.get(albumKey) ?? displayAlbum(song));
    artistTitles.set(artistKey, artistTitles.get(artistKey) ?? displayArtist(song));
    genreTitles.set(genreKey, genreTitles.get(genreKey) ?? genreLabel);
    const albumSongs = albums.get(albumKey);
    if (albumSongs) albumSongs.push(song);
    else albums.set(albumKey, [song]);
    const artistSongs = artists.get(artistKey);
    if (artistSongs) artistSongs.push(song);
    else artists.set(artistKey, [song]);
    const genreSongs = genres.get(genreKey);
    if (genreSongs) genreSongs.push(song);
    else genres.set(genreKey, [song]);
  }
  return {
    albumGroups: groupsFromMap('album', albums, albumTitles),
    artistGroups: groupsFromMap('artist', artists, artistTitles),
    genreGroups: groupsFromMap('genre', genres, genreTitles),
  };
};
