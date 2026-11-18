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

const mediaSource = 'media-library';
const isMediaRecord = (song: Song): boolean => song.fileInfo?.source === mediaSource
  || /^content:\/\/media\//i.test(song.fileInfo?.uri ?? song.uri ?? '');
const isSafRecord = (song: Song): boolean => song.fileInfo?.source === 'saf'
  || /^content:\/\/[^/]+\/tree\//i.test(song.fileInfo?.uri ?? song.uri ?? '');
const knownSources = (song: Song): string[] => {
  const sources = song.fileInfo?.librarySources ?? [];
  return isMediaRecord(song) && !sources.includes(mediaSource) ? [...sources, mediaSource] : sources;
};

/** Removal is an explicit persisted tombstone; a read error is never removal.
 * Song records and playlist IDs remain in storage, including missing files. */
export const getActiveLibrarySong = (song: Song, folders: ScanFolder[], includeDeviceMusic = false): Song | undefined => {
  const sources = knownSources(song);
  const absent = song.fileInfo?.absentLibrarySources ?? [];
  const matching = folders.find(folder => folder.enabled && !folder.removed && !absent.includes(folder.uri)
    && (sources.includes(folder.uri) || songBelongsToFolder(song, folder.uri)));
  const source = matching?.uri ?? (includeDeviceMusic && sources.includes(mediaSource) && !absent.includes(mediaSource)
    ? mediaSource : undefined);
  if (source) {
    const uri = song.fileInfo?.librarySourceUris?.[source];
    return uri && uri !== song.uri ? { ...song, uri, fileInfo: { ...song.fileInfo, uri } } : song;
  }
  // Direct imports without scan ownership remain in the library.
  return !sources.length && !isMediaRecord(song) && !isSafRecord(song)
    && !folders.some(folder => songBelongsToFolder(song, folder.uri)) ? song : undefined;
};

export const isSongInActiveLibrary = (song: Song, folders: ScanFolder[], includeDeviceMusic = false): boolean =>
  getActiveLibrarySong(song, folders, includeDeviceMusic) !== undefined;

export const selectActiveLibrarySongs = (songs: Song[], folders: ScanFolder[], includeDeviceMusic = false): Song[] =>
  songs.flatMap(song => {
    const active = getActiveLibrarySong(song, folders, includeDeviceMusic);
    return active ? [active] : [];
  });

const withObservedUri = (song: Song, source: string, uri?: string): Record<string, string> | undefined => {
  const previous = song.fileInfo?.librarySourceUris;
  return uri && previous?.[source] !== uri ? { ...previous, [source]: uri } : previous;
};

export const reconcileSourceObservation = (songs: Song[], observation: LibrarySourceObservation): Song[] => {
  const seen = new Map(observation.uris.map(uri => [getSongSourceKey(uri), uri]));
  return songs.map(song => {
    const key = getSongSourceKey(song.fileInfo?.uri ?? song.uri);
    const present = key ? seen.get(key) : undefined;
    const sources = knownSources(song);
    const owned = sources.includes(observation.source) || songBelongsToFolder(song, observation.source);
    if (!present && (!owned || !observation.complete)) return song;
    const next = present ? [...new Set([...sources, observation.source])] : sources;
    const absent = new Set(song.fileInfo?.absentLibrarySources ?? []);
    if (present) absent.delete(observation.source); else absent.add(observation.source);
    const sourceUris = withObservedUri(song, observation.source, present);
    if (sourceUris === song.fileInfo?.librarySourceUris && JSON.stringify(next) === JSON.stringify(song.fileInfo?.librarySources ?? [])
      && JSON.stringify([...absent]) === JSON.stringify(song.fileInfo?.absentLibrarySources ?? [])) return song;
    return { ...song, fileInfo: { ...song.fileInfo, librarySources: next, absentLibrarySources: [...absent],
      librarySourceUris: sourceUris } };
  });
};

export const observedLibraryUpdates = (songs: Song[], observations: LibrarySourceObservation[] = []): Song[] =>
  observations.reduce((current, observation) => reconcileSourceObservation(current, observation), songs);
