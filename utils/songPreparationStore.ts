import AsyncStorage from '@react-native-async-storage/async-storage';
import { WAVEFORM_FINGERPRINT_PREFIX } from './waveformTypes';

const STORAGE_KEY = '@musikplayer:prepared-sources:v1';
const prepared = new Set<string>();
const listeners = new Map<string, Set<() => void>>();
let hydration: Promise<void> | null = null;
let writes: Promise<void> = Promise.resolve();
let flush: Promise<void> | null = null;
let generation = 0;
let dirtyVersion = 0;
let persistedVersion = 0;

const validFingerprint = (value: unknown): value is string => typeof value === 'string'
  && value.startsWith(WAVEFORM_FINGERPRINT_PREFIX)
  && /^[0-9a-f]{32}$/.test(value.slice(WAVEFORM_FINGERPRINT_PREFIX.length));

const remember = (fingerprint: string, dirty = false): void => {
  if (prepared.has(fingerprint)) return;
  prepared.add(fingerprint);
  if (dirty) dirtyVersion += 1;
  listeners.get(fingerprint)?.forEach(listener => listener());
};

export const wasSongPrepared = (fingerprint: string): boolean => prepared.has(fingerprint);

/** Historical analysis completion; this does not prove waveform or bass availability. */
export const loadPreparedSources = (): Promise<void> => {
  if (hydration) return hydration;
  const currentGeneration = generation;
  hydration = AsyncStorage.getItem(STORAGE_KEY).then(raw => {
    if (currentGeneration !== generation || !raw) return;
    let stored: unknown;
    try { stored = JSON.parse(raw); } catch { return; }
    if (Array.isArray(stored)) {
      stored.filter(validFingerprint).forEach(fingerprint => remember(fingerprint));
    }
  }).catch(error => {
    if (currentGeneration === generation) hydration = null;
    throw error;
  });
  return hydration;
};

export const markSongPrepared = (fingerprint: string): Promise<void> => {
  if (!validFingerprint(fingerprint)) return Promise.resolve();
  remember(fingerprint, true);
  // Known ready rows take the constant-time path. A failed write leaves the
  // version dirty, so marking an already remembered source still retries it.
  if (flush) return flush;
  if (dirtyVersion === persistedVersion) return Promise.resolve();
  const currentGeneration = generation;
  const operation: Promise<void> = writes.catch(() => undefined).then(async () => {
    try {
      if (currentGeneration !== generation) return;
      await loadPreparedSources();
      while (currentGeneration === generation && dirtyVersion !== persistedVersion) {
        const snapshotVersion = dirtyVersion;
        const snapshot = JSON.stringify([...prepared]);
        await AsyncStorage.setItem(STORAGE_KEY, snapshot);
        if (currentGeneration === generation) persistedVersion = snapshotVersion;
      }
    } finally {
      if (flush === operation) flush = null;
    }
  });
  writes = operation;
  flush = operation;
  return operation;
};

export const subscribeSongPreparation = (fingerprint: string, listener: () => void): (() => void) => {
  const subscribers = listeners.get(fingerprint) ?? new Set();
  subscribers.add(listener);
  listeners.set(fingerprint, subscribers);
  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0) listeners.delete(fingerprint);
  };
};

export const resetSongPreparationForTests = (): void => {
  generation += 1;
  prepared.clear(); listeners.clear(); hydration = null; flush = null;
  dirtyVersion = 0; persistedVersion = 0;
  // Keep the write tail: an old native setItem cannot be cancelled, and must
  // settle before a new generation starts its hydration and write.
};
