import AsyncStorage from '@react-native-async-storage/async-storage';
import { WAVEFORM_FINGERPRINT_PREFIX } from './waveformTypes';

const STORAGE_KEY = '@musikplayer:prepared-sources:v1';
export const MAX_PREPARED_SOURCE_ENTRIES = 10000;
export const MAX_PREPARED_SOURCE_CODE_UNITS = 1024 * 1024;
const COMPLETION_BATCH_SIZE = 32;
const prepared = new Set<string>();
const listeners = new Map<string, Set<() => void>>();
let hydration: Promise<void> | null = null;
let writes: Promise<void> = Promise.resolve();
let flush: Promise<void> | null = null;
let generation = 0;
let dirtyVersion = 0;
let persistedVersion = 0;
let scheduledFlush: ReturnType<typeof setTimeout> | undefined;
let retainedFingerprints: ReadonlySet<string> | undefined;

const validFingerprint = (value: unknown): value is string => typeof value === 'string'
  && value.startsWith(WAVEFORM_FINGERPRINT_PREFIX)
  && /^[0-9a-f]{32}$/.test(value.slice(WAVEFORM_FINGERPRINT_PREFIX.length));

const remember = (fingerprint: string, dirty = false): void => {
  if (retainedFingerprints && !retainedFingerprints.has(fingerprint) && !listeners.has(fingerprint)) return;
  if (prepared.has(fingerprint)) return;
  prepared.add(fingerprint);
  if (prepared.size > MAX_PREPARED_SOURCE_ENTRIES) {
    for (const oldest of prepared) {
      if (!listeners.has(oldest)) prepared.delete(oldest);
      if (prepared.size <= MAX_PREPARED_SOURCE_ENTRIES) break;
    }
  }
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
    if (raw.length > MAX_PREPARED_SOURCE_CODE_UNITS) {
      console.warn('[Preparation] Optional completion history exceeds its size budget.');
      return;
    }
    let stored: unknown;
    try { stored = JSON.parse(raw); } catch { return; }
    if (Array.isArray(stored)) {
      // Persisted entries are older than completions received during hydration.
      const local = [...prepared];
      prepared.clear();
      const storedFingerprints = stored.filter(validFingerprint);
      const bounded = storedFingerprints.slice(-MAX_PREPARED_SOURCE_ENTRIES);
      bounded.forEach(fingerprint => remember(fingerprint));
      local.forEach(fingerprint => { prepared.delete(fingerprint); remember(fingerprint); });
      if (storedFingerprints.length > MAX_PREPARED_SOURCE_ENTRIES || bounded.some(fingerprint => !prepared.has(fingerprint))) {
        dirtyVersion += 1; scheduleCompletionFlush();
      }
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
  return flushPreparedSources();
};

/** Durable barrier retained for callers which require a confirmed history write. */
export const flushPreparedSources = (): Promise<void> => {
  clearTimeout(scheduledFlush); scheduledFlush = undefined;
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

const scheduleCompletionFlush = (): void => {
  if (dirtyVersion === persistedVersion || flush || scheduledFlush) return;
  scheduledFlush = setTimeout(() => { void flushPreparedSources().catch(error => {
    console.warn('[Preparation] Completion could not be persisted.', error);
  }); }, 1000);
};

/** Waveform payloads are already durable; optional history can share a bounded batch. */
export const queueSongPrepared = (fingerprint: string): void => {
  if (!validFingerprint(fingerprint)) return;
  remember(fingerprint, true);
  if (dirtyVersion - persistedVersion >= COMPLETION_BATCH_SIZE) {
    void flushPreparedSources().catch(error => console.warn('[Preparation] Completion could not be persisted.', error));
  } else scheduleCompletionFlush();
};

export const retainPreparedSources = (fingerprints: ReadonlySet<string>): void => {
  retainedFingerprints = fingerprints;
  let changed = false;
  prepared.forEach(fingerprint => {
    if (!fingerprints.has(fingerprint) && !listeners.has(fingerprint)) { prepared.delete(fingerprint); changed = true; }
  });
  if (changed) { dirtyVersion += 1; scheduleCompletionFlush(); }
};

export const subscribeSongPreparation = (fingerprint: string, listener: () => void): (() => void) => {
  const subscribers = listeners.get(fingerprint) ?? new Set();
  subscribers.add(listener);
  listeners.set(fingerprint, subscribers);
  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0) listeners.delete(fingerprint);
    if (retainedFingerprints && !retainedFingerprints.has(fingerprint) && !listeners.has(fingerprint) && prepared.delete(fingerprint)) {
      dirtyVersion += 1; scheduleCompletionFlush();
    }
  };
};

export const resetSongPreparationForTests = (): void => {
  generation += 1;
  clearTimeout(scheduledFlush); scheduledFlush = undefined; retainedFingerprints = undefined;
  prepared.clear(); listeners.clear(); hydration = null; flush = null;
  dirtyVersion = 0; persistedVersion = 0;
  // Keep the write tail: an old native setItem cannot be cancelled, and must
  // settle before a new generation starts its hydration and write.
};
