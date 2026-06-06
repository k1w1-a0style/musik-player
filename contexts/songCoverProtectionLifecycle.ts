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
  handoffPending: boolean;
  released: boolean;
};

export type SongCoverProtectionLease = {
  protection: CoverCacheProtection;
  updateSnapshot: (songs: Song[]) => void;
  handoff: (songs: Song[]) => void;
  markPersisting: () => void;
  finishPersistence: (result: PersistResult) => void;
  markConfirmed: () => void;
  releaseCurrent: () => void;
};

const entriesBySnapshot = new Map<string, ProtectionEntry>();
let confirmedEntry: ProtectionEntry | undefined;
let nextGeneration = 0;

export const getSongSnapshotKey = (songs: Song[]): string => JSON.stringify(songs);

const releaseEntryProtection = (entry: ProtectionEntry): void => {
  if (entry.released) return;
  entry.released = true;
  if (entriesBySnapshot.get(entry.snapshotKey) === entry) entriesBySnapshot.delete(entry.snapshotKey);
  entry.protection.release();
};

const maybeReleaseEntry = (entry: ProtectionEntry): void => {
  if (entry.released || entry === confirmedEntry || entry.currentOwners > 0 || entry.inFlightOwners > 0 || entry.handoffPending) return;
  releaseEntryProtection(entry);
};

const markEntryConfirmed = (entry: ProtectionEntry, releaseOlderHandoffs: boolean, releaseConfirmed: boolean): void => {
  const previousConfirmed = confirmedEntry;
  confirmedEntry = entry;
  entry.handoffPending = false;

  if (releaseOlderHandoffs) {
    entriesBySnapshot.forEach(candidate => {
      if (candidate !== entry && candidate.generation < entry.generation) {
        candidate.handoffPending = false;
        maybeReleaseEntry(candidate);
      }
    });
  }
  if (previousConfirmed && previousConfirmed !== entry) maybeReleaseEntry(previousConfirmed);
  if (releaseConfirmed) {
    confirmedEntry = undefined;
    releaseEntryProtection(entry);
  }
};

const moveEntryToSnapshot = (entry: ProtectionEntry, songs: Song[]): ProtectionEntry => {
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
  let entry: ProtectionEntry;
  if (existingEntry) {
    entry = existingEntry;
  } else {
    entry = {
      snapshotKey,
      generation: ++nextGeneration,
      protection: createCoverCacheProtection(),
      currentOwners: 0,
      inFlightOwners: 0,
      handoffPending: false,
      released: false,
    };
    entriesBySnapshot.set(snapshotKey, entry);
  }
  entry.protection.protectSongCovers(songs);
  entry.handoffPending = false;
  entry.currentOwners += 1;

  let ownsCurrent = true;
  let ownsInFlight = false;

  const releaseCurrent = (): void => {
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
      const previousEntry = entry;
      entry = moveEntryToSnapshot(entry, nextSongs);
      if (entry !== previousEntry && ownsCurrent) {
        previousEntry.currentOwners = Math.max(0, previousEntry.currentOwners - 1);
        entry.currentOwners += 1;
        maybeReleaseEntry(previousEntry);
      }
    },
    handoff: nextSongs => {
      const previousEntry = entry;
      entry = moveEntryToSnapshot(entry, nextSongs);
      if (entry !== previousEntry && ownsCurrent) {
        previousEntry.currentOwners = Math.max(0, previousEntry.currentOwners - 1);
        maybeReleaseEntry(previousEntry);
      } else if (ownsCurrent) {
        entry.currentOwners = Math.max(0, entry.currentOwners - 1);
      }
      ownsCurrent = false;
      entry.handoffPending = true;
    },
    markPersisting: () => {
      if (ownsInFlight) return;
      ownsInFlight = true;
      entry.inFlightOwners += 1;
    },
    finishPersistence: result => {
      if (ownsInFlight) {
        ownsInFlight = false;
        entry.inFlightOwners = Math.max(0, entry.inFlightOwners - 1);
      }
      if (result.status === 'stored' || result.status === 'unchanged') {
        markEntryConfirmed(entry, true, true);
      } else if (result.status === 'superseded') {
        // A superseded request may already have written this snapshot before a newer queued request finishes.
        markEntryConfirmed(entry, false, false);
      }
      maybeReleaseEntry(entry);
    },
    markConfirmed: () => {
      markEntryConfirmed(entry, true, true);
      maybeReleaseEntry(entry);
    },
    releaseCurrent,
  };
};

export const resetSongCoverProtectionLifecycleForTests = (): void => {
  const protections = new Set(Array.from(entriesBySnapshot.values()).map(entry => entry.protection));
  protections.forEach(protection => protection.release());
  entriesBySnapshot.clear();
  confirmedEntry = undefined;
  nextGeneration = 0;
};
