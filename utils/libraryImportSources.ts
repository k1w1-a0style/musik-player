import type { Song, SongFileInfo } from '../types/Song';
import type { ImportFileRevision } from './importFileRevision';
import { classifyImportSource, type ImportSourceDecision } from './libraryImportStatistics';

/** SAF tree grants can differ while referring to the same physical document. */
export const getImportSourceKey = (uri?: string): string | undefined => {
  if (!uri) return undefined;
  let decoded = uri.split(/[?#]/)[0];
  try { decoded = decodeURIComponent(decoded); } catch { /* Keep malformed URIs distinct. */ }
  const document = /^(content:\/\/[^/]+)\/.*\/document\/(.+)$/.exec(decoded);
  return document ? `${document[1]}/document/${document[2]}` : decoded.replace(/\/+$/, '');
};

export const indexImportedSources = (songs: Song[]): Map<string, Song> => {
  const index = new Map<string, Song>();
  songs.forEach(song => {
    for (const uri of [song.uri, song.fileInfo?.uri]) {
      const key = getImportSourceKey(uri);
      if (key) index.set(key, song);
    }
  });
  return index;
};

const recordRevisionMigration = (previous: Song, revision: ImportFileRevision, updates: Song[]): void => {
  if (Object.entries(revision).some(([field, value]) => value !== undefined
    && previous.fileInfo?.[field as keyof SongFileInfo] !== value)) {
    updates.push({ ...previous, fileInfo: { ...previous.fileInfo, ...revision } });
  }
};

export const createImportSourceSelection = (options: { existingSongs?: Song[]; refreshExisting?: boolean }) => {
  const previousSources = indexImportedSources(options.existingSongs ?? []);
  const seen = new Set<string>();
  let reused = 0;
  let unverified = 0;
  let duplicates = 0;
  const revisionUpdates: Song[] = [];
  const fullScan = options.refreshExisting ?? false;
  const select = (uri: string, revision?: ImportFileRevision): ImportSourceDecision => {
    const key = getImportSourceKey(uri) ?? uri;
    if (seen.has(key)) { duplicates += 1; return { include: false, outcome: 'duplicate', unverified: false }; }
    seen.add(key);
    const previous = previousSources.get(key);
    const outcome = classifyImportSource(previous, revision, fullScan);
    const decision = { include: fullScan || outcome === 'new' || outcome === 'changed', outcome,
      unverified: outcome === 'unverified' || Boolean(fullScan && !revision?.contentHash) };
    if (fullScan) {
      if (!revision?.contentHash) unverified += 1;
      return decision;
    }
    if (decision.include) return decision;
    if (decision.unverified) unverified += 1;
    else if (previous && revision) recordRevisionMigration(previous, revision, revisionUpdates);
    reused += 1;
    return decision;
  };
  return { previousSources, select, include: (uri: string, revision?: ImportFileRevision) => select(uri, revision).include,
    getRevisionUpdates: () => revisionUpdates,
    getReusedCount: () => reused, getUnverifiedCount: () => unverified, getSkippedCount: () => reused + duplicates };
};

const changedRevision = (previous: SongFileInfo = {}, current: SongFileInfo = {}): boolean =>
  previous.contentHash !== undefined && current.contentHash !== undefined
    ? previous.contentHash !== current.contentHash :
  (previous.size !== undefined && current.size !== undefined && previous.size !== current.size)
  || (previous.modificationTime !== undefined && current.modificationTime !== undefined && previous.modificationTime !== current.modificationTime)
  || (previous.modificationTime === undefined && current.modificationTime !== undefined
    && current.modificationTime > (previous.importedAt ?? Infinity));

/** A metadata rescan must not manufacture a new audio revision. */
export const preserveImportedSource = (song: Song, previous?: Song, forceAudioRevision = false): Song => {
  if (!previous) return song;
  const changed = forceAudioRevision || changedRevision(previous.fileInfo, song.fileInfo);
  return { ...song, id: previous.id, uri: previous.uri ?? song.uri,
    fileInfo: { ...song.fileInfo, uri: previous.fileInfo?.uri ?? previous.uri ?? song.uri,
      importedAt: changed ? Math.max(song.fileInfo?.importedAt ?? Date.now(), (previous.fileInfo?.importedAt ?? 0) + 1)
        : previous.fileInfo?.importedAt ?? song.fileInfo?.importedAt } };
};

export const getImportedPreparationSongs = (imported: Song[], merged: Song[]): Song[] => {
  const importedKeys = new Set(indexImportedSources(imported).keys());
  const importedIds = new Set(imported.filter(song => !song.uri).map(song => song.id));
  return merged.filter(song => importedKeys.has(getImportSourceKey(song.fileInfo?.uri ?? song.uri) ?? '')
    || importedIds.has(song.id));
};
