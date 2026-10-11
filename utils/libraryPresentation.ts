import type { Song } from '../types/Song';
import { SongMergeIndex } from './songMergeIndex';
import type { ScanFolder } from '../types/ScanFolder';
import { deriveFolderNameFromUri } from './mediaLibraryImport';
import { normalizeMetadataText, resolveDisplayAlbum, resolveDisplayArtist, resolveDisplayTitle } from './musicParser';
import { getSongArtworkUri } from './songArtwork';
import { getSongSourceKey } from './songSourceIdentity';
import { compareAlbumTracks } from './albumTrackOrder';

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

const basename = (value?: string): string => {
  if (!value) return '';
  const cleaned = value.replace(/\/+$/, '');
  return cleaned.split('/').filter(Boolean).pop() ?? cleaned;
};

const stripExtension = (value: string): string => value.replace(/\.[^.]+$/, '');

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

const buildAlbumGroupingKeyResolver = (songs: Song[]): ((song: Song) => string) => {
  const knownAlbumArtistsByAlbum = new Map<string, Set<string>>();

  for (const song of songs) {
    const albumPart = normalizeAlbumName(song.album);
    if (albumPart === UNKNOWN_ALBUM_KEY) continue;
    const albumArtistNorm = normalizeMetadataText(song.albumArtist)?.toLocaleLowerCase('de-DE');
    if (!albumArtistNorm) continue;
    const artistPart = normalizeArtistName(song.artist);
    const identity = `${albumPart}::${artistPart}`;
    const knownArtists = knownAlbumArtistsByAlbum.get(identity);
    if (knownArtists) knownArtists.add(albumArtistNorm);
    else knownAlbumArtistsByAlbum.set(identity, new Set([albumArtistNorm]));
  }

  return song => {
    const albumPart = normalizeAlbumName(song.album);
    const baseKey = `album:${albumPart}`;
    if (albumPart === UNKNOWN_ALBUM_KEY) return baseKey;

    const albumArtistNorm = normalizeMetadataText(song.albumArtist)?.toLocaleLowerCase('de-DE');
    if (albumArtistNorm) return `${baseKey}::${albumArtistNorm}`;

    const artist = normalizeArtistName(song.artist);
    const knownArtists = artist !== UNKNOWN_ARTIST_KEY ? knownAlbumArtistsByAlbum.get(`${albumPart}::${artist}`) : undefined;
    const inferredAlbumArtist = knownArtists?.size === 1 ? Array.from(knownArtists)[0] : undefined;
    return inferredAlbumArtist ? `${baseKey}::${inferredAlbumArtist}`
      : artist !== UNKNOWN_ARTIST_KEY ? `${baseKey}::${artist}` : baseKey;
  };
};

const normalizedSongUriKey = (song: Song): string | null => {
  const source = getSongSourceKey(song.fileInfo?.uri ?? song.uri);
  return source ? `uri:${source}` : null;
};

export const buildSongKey = (song: Pick<Song, 'id' | 'title' | 'artist' | 'uri' | 'fileInfo' | 'duration'>): string => {
  const id = normalizeLibraryText(song.id);
  if (id) return `song:${id}`;
  const rawUri = song.fileInfo?.uri ?? song.uri;
  if (rawUri) {
    const normalizedUri = getSongSourceKey(rawUri);
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

const applyMetadataInspection = (previousSong: Song, incomingSong: Song, merged: Song): void => {
  for (const field of incomingSong.metadataInspection?.absentFields ?? []) {
    if (field !== 'cover' && !hasNonEmptyText(incomingSong[field])) merged[field] = undefined;
  }
  const coverRemoved = (incomingSong.coverInfo?.status === 'none' && incomingSong.coverInfo.embeddedArtworkChecked)
    || incomingSong.metadataInspection?.absentFields.includes('cover');
  const preservePreview = previousSong.coverInfo?.pendingEmbeddedArtworkRefresh || previousSong.coverInfo?.embeddedArtworkRefreshFailed;
  if (!hasUsableArtwork(incomingSong) && hasUsableArtwork(previousSong) && (!coverRemoved || preservePreview)) {
    merged.cover = previousSong.cover;
    merged.coverInfo = previousSong.coverInfo;
  } else if (!hasUsableArtwork(incomingSong) && coverRemoved && !preservePreview) {
    merged.cover = undefined;
    merged.coverInfo = { ...incomingSong.coverInfo, status: 'none', uri: undefined, embeddedArtworkChecked: true };
  }
  // A receipt belongs to this inspection, never to a subsequent partial update.
  delete merged.metadataInspection;
};

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
    comment: preferText(incomingSong.comment, previousSong.comment),
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
  applyMetadataInspection(previousSong, incomingSong, merged);
  if (!previousSong.fileInfo && !incomingSong.fileInfo) delete merged.fileInfo;
  if (!previousSong.audioInfo && !incomingSong.audioInfo) delete merged.audioInfo;
  return merged;
};

export const getSongMergeKeys = (song: Song): string[] => [normalizedSongUriKey(song), song.id ? `id:${song.id}` : null].filter((key): key is string => !!key);
const groupTextOrder = new Intl.Collator('de-DE', { sensitivity: 'base' });
const songTitleKeys = new WeakMap<Song, { title: string; key: string }>();
const getSongTitleKeys = (song: Song) => {
  let keys = songTitleKeys.get(song);
  if (!keys) { keys = { title: displayTitle(song), key: buildSongKey(song) }; songTitleKeys.set(song, keys); }
  return keys;
};
export const compareSongTitles = (a: Song, b: Song): number => {
  const left = getSongTitleKeys(a); const right = getSongTitleKeys(b);
  return groupTextOrder.compare(left.title, right.title) || left.key.localeCompare(right.key);
};
const byGroupTitle = (a: LibraryGroupItem, b: LibraryGroupItem): number => groupTextOrder.compare(a.title, b.title) || a.id.localeCompare(b.id);

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
export const displayGenre = (song: Pick<Song, 'genre'>): string => normalizeMetadataText(cleanPersonLikeLabel(song.genre)) ?? UNKNOWN_GENRE_LABEL;

export const createSongMergeIndex = (songs: Song[] = []): SongMergeIndex =>
  new SongMergeIndex({ keys: getSongMergeKeys, merge: mergeSongPreservingRichMetadata, compare: compareSongTitles }, songs);

export const mergeSongs = (existingSongs: Song[], importedSongs: Song[]): Song[] => {
  const index = createSongMergeIndex(existingSongs);
  index.addAll(importedSongs);
  return index.snapshot();
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
    const sortedSongs = [...list].sort(kind === 'album' ? compareAlbumTracks : compareSongTitles);
    const title = titles.get(id) ?? (kind === 'album' ? UNKNOWN_ALBUM_LABEL : kind === 'artist' ? UNKNOWN_ARTIST_LABEL : UNKNOWN_GENRE_LABEL);
    return {
      id,
      title,
      subtitle: buildGroupSubtitle(kind, sortedSongs),
      cover: getSongArtworkUri(sortedSongs.find(song => !!getSongArtworkUri(song)) ?? sortedSongs[0]),
      songs: sortedSongs,
    };
  }).sort(byGroupTitle);

export const groupSongs = (songs: Song[], kind: LibraryGroupKind, identitySongs: Song[] = songs): LibraryGroupItem[] => {
  const grouped = new Map<string, Song[]>();
  const titles = new Map<string, string>();
  const resolveAlbumGroupingKey = kind === 'album' ? buildAlbumGroupingKeyResolver(identitySongs) : null;
  for (const song of songs) {
    const key = kind === 'album' ? resolveAlbumGroupingKey!(song) : kind === 'artist' ? buildArtistKey(song.artist) : `genre:${normalizeLibraryKeyPart(displayGenre(song), UNKNOWN_GENRE_KEY)}`;
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
  const resolveAlbumGroupingKey = buildAlbumGroupingKeyResolver(songs);
  for (const song of songs) {
    const albumKey = resolveAlbumGroupingKey(song);
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
