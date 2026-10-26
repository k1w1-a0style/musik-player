import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { getSongSourceKey } from './songSourceIdentity';

export interface LibrarySourceObservation { source: string; uris: string[]; complete: boolean }
const folderKey = (uri: string) => getSongSourceKey(uri.replace(/\/tree\/([^/]+)$/, '/document/$1'));
export const songBelongsToFolder = (song: Song, uri: string): boolean => {
  const root = folderKey(uri);
  const key = getSongSourceKey(song.fileInfo?.uri ?? song.uri);
  if (root?.startsWith('android-storage:') && key?.startsWith('android-storage:')) {
    return key === root || key.startsWith(root + '/');
  }
  return Boolean(song.uri?.startsWith(uri + '/document/')
    || (root && key && (key === root || key.startsWith(root + '/'))));
};

const knownSources = (song: Song): string[] => song.fileInfo?.librarySources ??
  (song.fileInfo?.source === 'media-library' ? ['media-library'] : []);

/** Removal is an explicit persisted tombstone; a read error is never removal.
 * Song records and playlist IDs remain in storage, including missing files. */
export const isSongInActiveLibrary = (song: Song, folders: ScanFolder[], mediaGranted?: boolean): boolean => {
  const sources = [...new Set([...knownSources(song), ...folders.filter(f => songBelongsToFolder(song, f.uri)).map(f => f.uri)])];
  if (!sources.length) return true;
  const absent = song.fileInfo?.absentLibrarySources ?? [];
  const explicitlyRemoved = folders.some(folder => folder.removed && songBelongsToFolder(song, folder.uri));
  return sources.some(source => !absent.includes(source)
    && (source === 'media-library' ? (!explicitlyRemoved || mediaGranted !== false) : !folders.some(f => f.uri === source && f.removed)
      || folders.some(f => f.uri === source && !f.removed)));
};

export const reconcileSourceObservation = (songs: Song[], observation: LibrarySourceObservation): Song[] => {
  const seen = new Set(observation.uris.map(getSongSourceKey).filter(Boolean));
  return songs.map(song => {
    const present = seen.has(getSongSourceKey(song.fileInfo?.uri ?? song.uri));
    const sources = knownSources(song);
    const owned = sources.includes(observation.source) || songBelongsToFolder(song, observation.source);
    if (!present && (!owned || !observation.complete)) return song;
    const next = present ? [...new Set([...sources, observation.source])] : sources;
    const absent = new Set(song.fileInfo?.absentLibrarySources ?? []);
    if (present) absent.delete(observation.source); else absent.add(observation.source);
    if (JSON.stringify(next) === JSON.stringify(song.fileInfo?.librarySources ?? [])
      && JSON.stringify([...absent]) === JSON.stringify(song.fileInfo?.absentLibrarySources ?? [])) return song;
    return { ...song, fileInfo: { ...song.fileInfo, librarySources: next, absentLibrarySources: [...absent] } };
  });
};

export const observedLibraryUpdates = (songs: Song[], observations: LibrarySourceObservation[] = []): Song[] =>
  observations.reduce((current, observation) => reconcileSourceObservation(current, observation), songs);
