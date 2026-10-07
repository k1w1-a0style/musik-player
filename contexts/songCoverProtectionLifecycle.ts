import type { Song } from '../types/Song';
import {
  createCoverCacheProtection,
  type CoverCacheProtection,
} from '../utils/coverCacheCleanup';
import type { PersistResult } from './musicPersistenceHelpers';

type ProtectionEntry = {
  snapshotKey: string;
  generation: number;
  protection: CoverCacheProtection;
  currentOwners: number;
  inFlightOwners: number;
  nextEffectHandoffOwners: number;
  hydrationHandoffOwners: number;
  provisionalStored: boolean;
  released: boolean;
};

export type SongCoverProtectionLease = {
  protection: CoverCacheProtection;
  updateSnapshot: (songs: Song[]) => void;
  handoffToNextEffect: (songs: Song[]) => void;
  handoffFromHydration: (songs: Song[]) => void;
  markPersisting: () => void;
  prepareConfirmedCleanup: (songs: Song[]) => void;
  finishPersistence: (result: PersistResult) => void;
  markConfirmedAfterCleanup: () => void;
  releaseCurrentOwner: () => void;
};

const entriesBySnapshot = new Map<string, ProtectionEntry>();
let confirmedEntry: ProtectionEntry | undefined;
let nextGeneration = 0;
let latestConfirmedGeneration = 0;
let pendingAcceptedProtection: CoverCacheProtection | undefined;
let pendingAcceptedSnapshotKey: string | undefined;


const hashSnapshotField = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
};

const compactSnapshotField = (value: string | undefined): string => {
  if (!value) return '-';
  return `${value.length}:${hashSnapshotField(value)}`;
};

const getSongArtworkSnapshot = (song: Song): string => {
  const artworkStatus = song.coverInfo?.status ?? (song.cover || song.coverInfo?.uri ? 'unknown' : 'none');
  return [
    artworkStatus,
    compactSnapshotField(song.cover),
    compactSnapshotField(song.coverInfo?.uri),
  ].join('@');
};

export const getSongSnapshotKey = (songs: Song[]): string => songs
  .map(song => [
    compactSnapshotField(song.id),
    compactSnapshotField(song.uri),
    getSongArtworkSnapshot(song),
  ].join('|'))
  .join('\n');

/** One replaceable handoff protects accepted import batches before React has
 * committed their effect. Skipped intermediate renders do not accumulate owners. */
export const protectAcceptedSongCovers = (songs: Song[]): void => {
  pendingAcceptedProtection ??= createCoverCacheProtection();
  pendingAcceptedProtection.replaceProtectedSongCovers(songs);
  pendingAcceptedSnapshotKey = getSongSnapshotKey(songs);
};

const protectSnapshotAndClaimAcceptedHandoff = (
  protection: CoverCacheProtection, songs: Song[], snapshotKey: string,
): void => {
  // Acquire the real effect lease before releasing the import handoff.
  protection.protectSongCovers(songs);
  if (snapshotKey !== pendingAcceptedSnapshotKey) return;
  pendingAcceptedProtection?.release();
  pendingAcceptedProtection = undefined;
  pendingAcceptedSnapshotKey = undefined;
};

const releaseEntryProtection = (entry: ProtectionEntry): void => {
  if (entry.released) return;
  entry.released = true;
  if (entriesBySnapshot.get(entry.snapshotKey) === entry) entriesBySnapshot.delete(entry.snapshotKey);
  entry.protection.release();
};

const maybeReleaseEntry = (entry: ProtectionEntry): void => {
  if (
    entry.released
    || entry === confirmedEntry
    || entry.currentOwners > 0
    || entry.inFlightOwners > 0
    || entry.nextEffectHandoffOwners > 0
    || entry.hydrationHandoffOwners > 0
    || entry.provisionalStored
  ) return;
  releaseEntryProtection(entry);
};

const prepareEntryForConfirmedCleanup = (entry: ProtectionEntry, songs: Song[]): void => {
  if (entry.released) return;
  entry.protection.replaceProtectedSongCovers(songs);

  entriesBySnapshot.forEach(candidate => {
    if (
      candidate !== entry
      && candidate.generation < entry.generation
      && candidate.currentOwners === 0
      && candidate.inFlightOwners === 0
      && candidate.nextEffectHandoffOwners === 0
      && candidate.hydrationHandoffOwners === 0
    ) {
      candidate.provisionalStored = false;
      maybeReleaseEntry(candidate);
    }
  });
};

const markEntryConfirmedAfterCleanup = (entry: ProtectionEntry): void => {
  const previousConfirmed = confirmedEntry;
  confirmedEntry = entry;
  latestConfirmedGeneration = Math.max(latestConfirmedGeneration, entry.generation);
  entry.provisionalStored = false;
  entry.nextEffectHandoffOwners = 0;
  entry.hydrationHandoffOwners = 0;

  entriesBySnapshot.forEach(candidate => {
    if (candidate !== entry && candidate.generation < entry.generation) {
      candidate.nextEffectHandoffOwners = 0;
      candidate.hydrationHandoffOwners = 0;
      candidate.provisionalStored = false;
      maybeReleaseEntry(candidate);
    }
  });
  if (previousConfirmed && previousConfirmed !== entry) maybeReleaseEntry(previousConfirmed);
  confirmedEntry = undefined;
  maybeReleaseEntry(entry);
};

const moveEntryToSnapshot = (entry: ProtectionEntry, songs: Song[]): ProtectionEntry => {
  if (entry.released) return entry;
  entry.protection.protectSongCovers(songs);
  const snapshotKey = getSongSnapshotKey(songs);
  if (snapshotKey === entry.snapshotKey) return entry;

  const existing = entriesBySnapshot.get(snapshotKey);
  if (existing && existing !== entry) {
    existing.protection.protectSongCovers(songs);
    return existing;
  }

  if (entriesBySnapshot.get(entry.snapshotKey) === entry) entriesBySnapshot.delete(entry.snapshotKey);
  entry.snapshotKey = snapshotKey;
  entriesBySnapshot.set(snapshotKey, entry);
  return entry;
};

export const acquireSongCoverProtection = (songs: Song[]): SongCoverProtectionLease => {
  const snapshotKey = getSongSnapshotKey(songs);
  const existingEntry = entriesBySnapshot.get(snapshotKey);
  if (existingEntry?.released) entriesBySnapshot.delete(snapshotKey);
  let entry: ProtectionEntry;
  if (existingEntry && !existingEntry.released) {
    entry = existingEntry;
  } else {
    entry = {
      snapshotKey,
      generation: ++nextGeneration,
      protection: createCoverCacheProtection(),
      currentOwners: 0,
      inFlightOwners: 0,
      nextEffectHandoffOwners: 0,
      hydrationHandoffOwners: 0,
      provisionalStored: false,
      released: false,
    };
    entriesBySnapshot.set(snapshotKey, entry);
  }
  protectSnapshotAndClaimAcceptedHandoff(entry.protection, songs, snapshotKey);
  if (entry.nextEffectHandoffOwners > 0) entry.nextEffectHandoffOwners -= 1;
  else if (entry.hydrationHandoffOwners > 0) entry.hydrationHandoffOwners -= 1;
  entry.currentOwners += 1;

  let ownsCurrent = true;
  let ownsInFlight = false;

  const releaseCurrentOwner = (): void => {
    if (!ownsCurrent) return;
    ownsCurrent = false;
    entry.currentOwners = Math.max(0, entry.currentOwners - 1);
    maybeReleaseEntry(entry);
  };

  return {
    get protection() {
      return entry.protection;
    },
    updateSnapshot: nextSongs => {
      if (entry.released) return;
      const previousEntry = entry;
      entry = moveEntryToSnapshot(entry, nextSongs);
      if (entry !== previousEntry && ownsCurrent) {
        previousEntry.currentOwners = Math.max(0, previousEntry.currentOwners - 1);
        entry.currentOwners += 1;
        maybeReleaseEntry(previousEntry);
      }
    },
    handoffToNextEffect: nextSongs => {
      if (entry.released) return;
      const previousEntry = entry;
      entry = moveEntryToSnapshot(entry, nextSongs);
      if (entry !== previousEntry && ownsCurrent) {
        previousEntry.currentOwners = Math.max(0, previousEntry.currentOwners - 1);
        maybeReleaseEntry(previousEntry);
      } else if (ownsCurrent) {
        entry.currentOwners = Math.max(0, entry.currentOwners - 1);
      }
      ownsCurrent = false;
      entry.nextEffectHandoffOwners += 1;
    },
    handoffFromHydration: nextSongs => {
      if (entry.released) return;
      const previousEntry = entry;
      entry = moveEntryToSnapshot(entry, nextSongs);
      if (entry !== previousEntry && ownsCurrent) {
        previousEntry.currentOwners = Math.max(0, previousEntry.currentOwners - 1);
        maybeReleaseEntry(previousEntry);
      } else if (ownsCurrent) {
        entry.currentOwners = Math.max(0, entry.currentOwners - 1);
      }
      ownsCurrent = false;
      entry.hydrationHandoffOwners += 1;
    },
    markPersisting: () => {
      if (entry.released || ownsInFlight) return;
      ownsInFlight = true;
      entry.inFlightOwners += 1;
    },
    prepareConfirmedCleanup: songs => {
      prepareEntryForConfirmedCleanup(entry, songs);
    },
    finishPersistence: result => {
      if (entry.released) return;
      if (ownsInFlight) {
        ownsInFlight = false;
        entry.inFlightOwners = Math.max(0, entry.inFlightOwners - 1);
      }
      if (result.status === 'stored' || result.status === 'unchanged') {
        releaseCurrentOwner();
        markEntryConfirmedAfterCleanup(entry);
      } else if (result.status === 'superseded') {
        // A superseded request may already have written this snapshot before a newer queued request finishes.
        entry.provisionalStored = entry.generation >= latestConfirmedGeneration;
      }
      maybeReleaseEntry(entry);
    },
    markConfirmedAfterCleanup: () => {
      if (entry.released) return;
      releaseCurrentOwner();
      markEntryConfirmedAfterCleanup(entry);
      maybeReleaseEntry(entry);
    },
    releaseCurrentOwner,
  };
};

export const resetSongCoverProtectionLifecycleForTests = (): void => {
  pendingAcceptedProtection?.release();
  pendingAcceptedProtection = undefined;
  pendingAcceptedSnapshotKey = undefined;
  const protections = new Set(Array.from(entriesBySnapshot.values()).map(entry => entry.protection));
  protections.forEach(protection => protection.release());
  entriesBySnapshot.clear();
  confirmedEntry = undefined;
  nextGeneration = 0;
  latestConfirmedGeneration = 0;
};
