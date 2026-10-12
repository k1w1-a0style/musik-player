import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { getSongSourceKey } from './songSourceIdentity';

export const uniqueCleanerSongs = (songs: readonly Song[], ids?: readonly string[]): Song[] => {
  const selected = ids ? new Set(ids) : undefined;
  const sources = new Set<string>();
  return songs.filter(song => {
    if (selected && !selected.has(song.id)) return false;
    const key = getSongSourceKey(song.fileInfo?.uri ?? song.uri) ?? `id:${song.id}`;
    if (sources.has(key)) return false;
    sources.add(key);
    return true;
  });
};
type ExactLocation = { volume: string; segments: string[] };
const safeSegments = (path: string): string[] | undefined => {
  const segments = path.split('/').filter(Boolean);
  return segments.some(segment => segment === '.' || segment === '..') ? undefined : segments;
};
const fileLocation = (uri: string): ExactLocation | undefined => {
  const match = /^file:\/\/([^/?#]*)(\/[^?#]*)$/.exec(uri);
  if (!match) return undefined;
  const segments = safeSegments(decodeURIComponent(match[2]));
  return segments ? { volume: `file:${match[1]}`, segments } : undefined;
};
const documentLocation = (uri: string): ExactLocation | undefined => {
  const match = /^content:\/\/com\.android\.externalstorage\.documents\/(?:tree\/([^/?#]+)(?:\/document\/([^/?#]+))?|document\/([^/?#]+))$/.exec(uri);
  const id = match && decodeURIComponent(match[2] ?? match[3] ?? match[1]);
  if (!id) return undefined;
  const colon = id.indexOf(':');
  if (colon < 1) return undefined;
  const segments = safeSegments(id.slice(colon + 1));
  return segments ? { volume: `saf:${id.slice(0, colon)}`, segments } : undefined;
};
const location = (uri?: string): ExactLocation | undefined => {
  try { return uri ? fileLocation(uri) ?? documentLocation(uri) : undefined; }
  catch { return undefined; }
};
const contains = (file: ExactLocation, folder: ExactLocation, recursive: boolean): boolean =>
  file.volume === folder.volume && file.segments.length > folder.segments.length
  && (recursive || file.segments.length === folder.segments.length + 1)
  && folder.segments.every((segment, index) => segment === file.segments[index]);

export const resolveCleanerFolderSelection = (songs: readonly Song[], folders: readonly ScanFolder[], recursive: boolean): {
  songIds: string[]; countsByFolder: Record<string, number>; unresolvedFolderIds: string[];
} => {
  const selected = new Set<string>();
  const countsByFolder: Record<string, number> = {};
  const unresolvedFolderIds: string[] = [];
  const candidates = uniqueCleanerSongs(songs).map(song => ({ song, place: location(song.fileInfo?.uri ?? song.uri) }));
  for (const folder of folders) {
    const place = location(folder.uri);
    countsByFolder[folder.id] = 0;
    if (!place) { unresolvedFolderIds.push(folder.id); continue; }
    for (const candidate of candidates) {
      if (candidate.place && contains(candidate.place, place, recursive)) {
        selected.add(candidate.song.id);
        countsByFolder[folder.id] += 1;
      }
    }
  }
  return { songIds: [...selected], countsByFolder, unresolvedFolderIds };
};

export const getCleanerUnresolvedSongIds = (songs: readonly Song[]): string[] =>
  uniqueCleanerSongs(songs).filter(song => !location(song.fileInfo?.uri ?? song.uri)).map(song => song.id);
