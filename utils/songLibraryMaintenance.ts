import AsyncStorage from '@react-native-async-storage/async-storage';
import { isMetadataRefreshActive } from './metadataRefreshActivity';
import { isWaveformExtractionActive } from './waveformExtractionLifecycle';
import { assertPersistenceEpoch, capturePersistenceEpoch, registerPersistenceFlusher,
  trackPersistenceWork } from './persistenceMaintenance';

export const SONG_LIBRARY_MAINTENANCE_DELAY_MS = 1000;
export const MAX_SONG_LIBRARY_MAINTENANCE_DELETES = 256;
const chunkPrefix = '@musikplayer:song-library:v2:chunk:';
let activeKeys = new Set<string>();
const inFlightKeys = new Map<string, number>();
const legacyPolicy = new Map<string, boolean>();
// A native delete owns every affected key until its real settlement. A later
// writer waits only for deletes of the content it needs to read/write again.
const deleting = new Map<string, Promise<void>>();
let timer: ReturnType<typeof setTimeout> | undefined;
let flight: Promise<void> | undefined;
let requested = false;
let generation = 0;
let scheduledEpoch = 0;

const isProtected = (key: string): boolean => activeKeys.has(key)
  || inFlightKeys.has(key) || legacyPolicy.get(key) === false;

export const setSongLibraryLegacyPolicy = (key: string, remove: boolean): void => { legacyPolicy.set(key, remove); };
export const setActiveSongLibraryKeys = (keys: Iterable<string>): void => { activeKeys = new Set(keys); };
export const protectSongLibraryKeys = (keys: Iterable<string>): (() => void) => {
  const unique = new Set(keys);
  const ownGeneration = generation;
  unique.forEach(key => inFlightKeys.set(key, (inFlightKeys.get(key) ?? 0) + 1));
  return () => { if (ownGeneration !== generation) return; unique.forEach(key => {
    const count = (inFlightKeys.get(key) ?? 1) - 1;
    if (count === 0) inFlightKeys.delete(key); else inFlightKeys.set(key, count);
  }); };
};
export const waitForSongLibraryDeletes = async (keys: Iterable<string>): Promise<void> => {
  await Promise.allSettled([...new Set(keys)].map(key => deleting.get(key)));
};

const reserveDelete = (keys: readonly string[], remove: () => Promise<void>): Promise<void> | undefined => {
  if (keys.length === 0) return undefined;
  const work = trackPersistenceWork(Promise.resolve().then(remove));
  keys.forEach(key => deleting.set(key, work));
  const release = (): void => { keys.forEach(key => { if (deleting.get(key) === work) deleting.delete(key); }); };
  void work.then(release, release);
  return work;
};

const deleteLegacy = async (owner: number): Promise<number> => {
  let count = 0;
  for (const [key, remove] of legacyPolicy) {
    assertPersistenceEpoch(owner);
    // No await between policy/protection check and reservation.
    if (!remove || isProtected(key) || deleting.has(key)) continue;
    const work = reserveDelete([key], () => AsyncStorage.removeItem(key));
    await work?.then(() => { if (legacyPolicy.get(key) === true) legacyPolicy.delete(key); }, () => undefined);
    count += 1;
    if (count >= MAX_SONG_LIBRARY_MAINTENANCE_DELETES) break;
  }
  return count;
};

const cleanupPass = async (owner: number, ownGeneration: number): Promise<void> => {
  assertPersistenceEpoch(owner);
  const legacyDeletes = await deleteLegacy(owner);
  const keys = await AsyncStorage.getAllKeys();
  assertPersistenceEpoch(owner);
  if (ownGeneration !== generation) return;
  const stale = keys.filter(key => key.startsWith(chunkPrefix) && !isProtected(key) && !deleting.has(key));
  const batch = stale.slice(0, MAX_SONG_LIBRARY_MAINTENANCE_DELETES - legacyDeletes);
  // Recheck at reservation, after enumeration; queued/current manifests and
  // writes can have changed while the provider was resolving getAllKeys.
  const reserved = batch.filter(key => !isProtected(key) && !deleting.has(key));
  await reserveDelete(reserved, () => AsyncStorage.multiRemove(reserved));
  if (stale.length > batch.length) requested = true;
};

const startMaintenance = (force: boolean): void => {
  if (flight) { requested = true; return; }
  if (!force && (isMetadataRefreshActive() || isWaveformExtractionActive())) { requestSongLibraryMaintenance(scheduledEpoch); return; }
  requested = false;
  const ownGeneration = generation;
  const work = trackPersistenceWork(cleanupPass(scheduledEpoch, ownGeneration).catch(() => undefined));
  flight = work;
  void work.then(() => {
    if (ownGeneration !== generation) return;
    flight = undefined;
    if (requested) requestSongLibraryMaintenance(scheduledEpoch);
  });
};

export const requestSongLibraryMaintenance = (owner = capturePersistenceEpoch()): void => {
  requested = true;
  scheduledEpoch = owner;
  if (timer || flight) return;
  timer = setTimeout(() => { timer = undefined; startMaintenance(false); }, SONG_LIBRARY_MAINTENANCE_DELAY_MS);
};
const flushScheduledMaintenance = (): void => {
  if (timer) { clearTimeout(timer); timer = undefined; }
  if (requested) startMaintenance(true);
};
registerPersistenceFlusher(flushScheduledMaintenance);

export const flushSongLibraryMaintenance = async (): Promise<void> => {
  flushScheduledMaintenance();
  while (flight) { await flight; flushScheduledMaintenance(); }
};
export const resetSongLibraryMaintenanceForTests = (): void => {
  generation += 1;
  if (timer) clearTimeout(timer);
  timer = undefined; flight = undefined; requested = false;
  activeKeys.clear(); inFlightKeys.clear(); legacyPolicy.clear(); deleting.clear();
};
