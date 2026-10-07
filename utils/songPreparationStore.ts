import AsyncStorage from '@react-native-async-storage/async-storage';
import { WAVEFORM_FINGERPRINT_PREFIX } from './waveformTypes';

const STORAGE_KEY = '@musikplayer:prepared-sources:v1';
const prepared = new Set<string>();
const listeners = new Map<string, Set<() => void>>();
let hydration: Promise<void> | null = null;
let writes: Promise<void> = Promise.resolve();
let generation = 0;
let persistedSnapshot = '';

const validFingerprint = (value: unknown): value is string => typeof value === 'string'
  && value.startsWith(WAVEFORM_FINGERPRINT_PREFIX)
  && /^[0-9a-f]{32}$/.test(value.slice(WAVEFORM_FINGERPRINT_PREFIX.length));

const remember = (fingerprint: string): void => {
  if (prepared.has(fingerprint)) return;
  prepared.add(fingerprint);
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
      persistedSnapshot = JSON.stringify(stored.filter(validFingerprint));
      stored.filter(validFingerprint).forEach(remember);
    }
  }).catch(error => {
    if (currentGeneration === generation) hydration = null;
    throw error;
  });
  return hydration;
};

export const markSongPrepared = (fingerprint: string): Promise<void> => {
  if (!validFingerprint(fingerprint)) return Promise.resolve();
  remember(fingerprint);
  const currentGeneration = generation;
  const operation = writes.catch(() => undefined).then(async () => {
    await loadPreparedSources();
    const snapshot = JSON.stringify([...prepared]);
    if (currentGeneration !== generation || snapshot === persistedSnapshot) return;
    await AsyncStorage.setItem(STORAGE_KEY, snapshot);
    if (currentGeneration === generation) persistedSnapshot = snapshot;
  });
  writes = operation;
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
  prepared.clear(); listeners.clear(); hydration = null; writes = Promise.resolve(); persistedSnapshot = '';
};
