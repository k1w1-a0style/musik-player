import type { Song } from '../types/Song';
import { isRelativeM3uLocation, m3uLocationKey } from './m3uPaths';

export const MAX_M3U_CODE_UNITS = 2_097_152;
export const MAX_M3U_ENTRIES = 10_000;
export interface M3uEntry { location: string; label?: string; line: number }
export interface M3uUnresolved extends M3uEntry {
  reason: 'missing' | 'ambiguous' | 'relative' | 'unsupported' | 'unreadable';
}
export interface M3uResolution { songs: Song[]; unresolved: M3uUnresolved[]; duplicates: number }

export const parseM3u = (raw: string): M3uEntry[] => {
  if (raw.length > MAX_M3U_CODE_UNITS) throw new Error('Die Playlist ist größer als 2 MB Text.');
  if (/[\u0000\ufffd]/.test(raw)) throw new Error('Die Playlist muss gültiger UTF-8-Text sein.');
  const entries: M3uEntry[] = [];
  let label: string | undefined;
  for (const [index, source] of raw.replace(/^\ufeff/, '').split(/\r\n|\n|\r/).entries()) {
    if (source.length > 8192) throw new Error('Eine Playlist-Zeile ist zu lang.');
    const line = source.trim();
    if (!line) continue;
    if (/^#EXTINF:/i.test(line)) {
      label = line.slice(line.indexOf(',') + 1) || undefined;
    } else if (!line.startsWith('#')) {
      entries.push({ location: line, label, line: index + 1 });
      label = undefined;
      if (entries.length > MAX_M3U_ENTRIES) throw new Error('Höchstens 10.000 Playlist-Einträge sind erlaubt.');
    }
  }
  return entries;
};

const libraryIndex = (songs: Song[]): Map<string, Song | null> => {
  const index = new Map<string, Song | null>();
  for (const song of songs) {
    for (const uri of [song.uri, song.fileInfo?.uri]) {
      const key = uri ? m3uLocationKey(uri) : null;
      if (!key) continue;
      const previous = index.get(key);
      index.set(key, previous === undefined || previous?.id === song.id ? song : null);
    }
  }
  return index;
};

export const resolveM3u = (entries: M3uEntry[], library: Song[], playlistUri: string): M3uResolution => {
  const index = libraryIndex(library);
  const result: M3uResolution = { songs: [], unresolved: [], duplicates: 0 };
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = m3uLocationKey(entry.location, playlistUri);
    const song = key ? index.get(key) : undefined;
    if (!song) {
      const reason = key ? (song === null ? 'ambiguous' : 'missing')
        : isRelativeM3uLocation(entry.location) ? 'relative' : 'unsupported';
      result.unresolved.push({ ...entry, reason });
    } else if (seen.has(song.id)) result.duplicates += 1;
    else { seen.add(song.id); result.songs.push(song); }
  }
  return result;
};

export const songPlaylistUri = (song: Song): string | undefined => song.uri || song.fileInfo?.uri;
const singleLine = (value: string): string => value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();

export const serializeM3u8 = (songs: Song[]): string => {
  if (!songs.length) throw new Error('Diese Playlist enthält keine exportierbaren Titel.');
  if (songs.length > MAX_M3U_ENTRIES) throw new Error('Höchstens 10.000 Playlist-Einträge sind erlaubt.');
  const lines = ['#EXTM3U'];
  for (const song of songs) {
    const uri = songPlaylistUri(song);
    if (!uri || !m3uLocationKey(uri)) throw new Error('Ein Titel hat keine sichere lokale Dateiquelle.');
    const seconds = Number.isFinite(song.duration) && song.duration! >= 0 ? Math.round(song.duration!) : -1;
    lines.push(`#EXTINF:${seconds},${singleLine(`${song.artist} - ${song.title}`)}`, uri);
  }
  const raw = `${lines.join('\n')}\n`;
  // Apply identical bounds to exports so every generated file can be imported.
  parseM3u(raw);
  return raw;
};
