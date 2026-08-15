import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isSongWaveform,
  isWaveformSourceIdentity,
  type SongWaveform,
  type WaveformSourceIdentity,
} from './waveformTypes';

const LEGACY_PREFIX = '@musikplayer:waveform:';
const PREFIX = `${LEGACY_PREFIX}v3:`;
const INDEX_KEY = `${PREFIX}index`;
const MAX_CACHED_WAVEFORMS = 80;
let cacheMutationQueue = Promise.resolve();
let cacheInitialization: Promise<void> | null = null;
let cachedIndex: WaveformSourceIdentity[] | null = null;
const memoryWaveforms = new Map<string, SongWaveform>();

const keyForSource = (sourceKey: string): string => `${PREFIX}${sourceKey}`;
const isPayloadKey = (key: string): boolean => key.startsWith(PREFIX) && key !== INDEX_KEY;
const isLegacyKey = (key: string): boolean => key.startsWith(LEGACY_PREFIX) && !key.startsWith(PREFIX);

const sameIdentity = (left: WaveformSourceIdentity, right: WaveformSourceIdentity): boolean =>
  left.sourceKey === right.sourceKey && left.sourceFingerprint === right.sourceFingerprint;

const rememberWaveform = (waveform: SongWaveform): void => {
  memoryWaveforms.delete(waveform.sourceKey);
  memoryWaveforms.set(waveform.sourceKey, waveform);
  while (memoryWaveforms.size > MAX_CACHED_WAVEFORMS) {
    const oldestSourceKey = memoryWaveforms.keys().next().value as string | undefined;
    if (!oldestSourceKey) break;
    memoryWaveforms.delete(oldestSourceKey);
  }
};

export const peekCachedWaveform = (identity: WaveformSourceIdentity): SongWaveform | null => {
  if (!isWaveformSourceIdentity(identity)) return null;
  const waveform = memoryWaveforms.get(identity.sourceKey);
  if (!waveform || !sameIdentity(waveform, identity)) return null;
  rememberWaveform(waveform);
  return waveform;
};

const initializeCache = async (): Promise<void> => {
  if (!cacheInitialization) {
    cacheInitialization = (async () => {
      const keys = await AsyncStorage.getAllKeys();
      const legacyKeys = keys.filter(isLegacyKey);
      await Promise.all(legacyKeys.map(key => AsyncStorage.removeItem(key)));
    })().catch(error => {
      cacheInitialization = null;
      throw error;
    });
  }
  await cacheInitialization;
};

const writeIndex = async (entries: WaveformSourceIdentity[]): Promise<void> => {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(entries.slice(0, MAX_CACHED_WAVEFORMS)));
};

const readStoredWaveform = async (key: string): Promise<SongWaveform | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isSongWaveform(parsed)) return null;
    return key === keyForSource(parsed.sourceKey) ? parsed : null;
  } catch {
    return null;
  }
};

const listStoredWaveforms = async (): Promise<SongWaveform[]> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(isPayloadKey);
  const loaded = await Promise.all(keys.map(async key => ({ key, waveform: await readStoredWaveform(key) })));
  const invalidKeys = loaded.filter(item => !item.waveform).map(item => item.key);
  await Promise.all(invalidKeys.map(key => AsyncStorage.removeItem(key).catch(() => undefined)));
  return loaded.flatMap(item => item.waveform ? [item.waveform] : []);
};

const parseIndex = (raw: string | null): WaveformSourceIdentity[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isWaveformSourceIdentity)) return [];
    return parsed;
  } catch {
    return [];
  }
};

const reconcileIndex = async (preferred: WaveformSourceIdentity[]): Promise<WaveformSourceIdentity[]> => {
  const stored = await listStoredWaveforms();
  const bySourceKey = new Map(stored.map(waveform => [waveform.sourceKey, waveform]));
  const ordered: WaveformSourceIdentity[] = [];

  for (const identity of preferred) {
    const waveform = bySourceKey.get(identity.sourceKey);
    if (!waveform || !sameIdentity(identity, waveform)) continue;
    ordered.push(identity);
    bySourceKey.delete(identity.sourceKey);
  }

  const recovered = [...bySourceKey.values()]
    .sort((left, right) => right.generatedAt - left.generatedAt)
    .map(({ sourceKey, sourceFingerprint }) => ({ sourceKey, sourceFingerprint }));
  const complete = [...ordered, ...recovered];
  const active = complete.slice(0, MAX_CACHED_WAVEFORMS);
  const stale = complete.slice(MAX_CACHED_WAVEFORMS);

  await writeIndex(active);
  await Promise.all(stale.map(identity => AsyncStorage.removeItem(keyForSource(identity.sourceKey)).catch(() => undefined)));
  return active;
};

const readIndex = async (): Promise<WaveformSourceIdentity[]> => {
  if (cachedIndex) return cachedIndex;
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  const reconciled = await reconcileIndex(parseIndex(raw));
  cachedIndex = reconciled;
  return reconciled;
};

const runCacheMutation = async <T>(operation: () => Promise<T>): Promise<T> => {
  const current = cacheMutationQueue.catch(() => undefined).then(operation);
  cacheMutationQueue = current.then(() => undefined, () => undefined);
  return current;
};

export const getCachedWaveform = async (identity: WaveformSourceIdentity): Promise<SongWaveform | null> => {
  if (!isWaveformSourceIdentity(identity)) return null;
  const inMemory = peekCachedWaveform(identity);
  if (inMemory) return inMemory;
  await initializeCache();
  const waveform = await readStoredWaveform(keyForSource(identity.sourceKey));
  if (!waveform || !sameIdentity(waveform, identity)) return null;
  rememberWaveform(waveform);
  return waveform;
};

export const setCachedWaveform = async (waveform: SongWaveform): Promise<void> => {
  if (!isSongWaveform(waveform)) return;
  // Make the finalized shape available to remounts immediately. Persistence is
  // still serialized below, but a slow storage write must not trigger a second
  // extraction or a different interim waveform in the current app session.
  rememberWaveform(waveform);
  await runCacheMutation(async () => {
    await initializeCache();
    const existing = await readIndex();
    const payloadKey = keyForSource(waveform.sourceKey);
    const previousPayload = await AsyncStorage.getItem(payloadKey);
    await AsyncStorage.setItem(payloadKey, JSON.stringify(waveform));

    const identity = { sourceKey: waveform.sourceKey, sourceFingerprint: waveform.sourceFingerprint };
    const next = [identity, ...existing.filter(entry => entry.sourceKey !== waveform.sourceKey)];
    try {
      await writeIndex(next);
      cachedIndex = next.slice(0, MAX_CACHED_WAVEFORMS);
    } catch (error) {
      if (previousPayload === null) await AsyncStorage.removeItem(payloadKey).catch(() => undefined);
      else await AsyncStorage.setItem(payloadKey, previousPayload).catch(() => undefined);
      throw error;
    }

    const stale = next.slice(MAX_CACHED_WAVEFORMS);
    await Promise.all(stale.map(entry => AsyncStorage.removeItem(keyForSource(entry.sourceKey))));
  });
};

export const clearWaveformCache = async (): Promise<void> => runCacheMutation(async () => {
  await initializeCache();
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(LEGACY_PREFIX));
  await Promise.all(keys.map(key => AsyncStorage.removeItem(key)));
  cachedIndex = [];
  memoryWaveforms.clear();
});

export const resetWaveformCacheStateForTests = (): void => {
  cacheMutationQueue = Promise.resolve();
  cacheInitialization = null;
  cachedIndex = null;
  memoryWaveforms.clear();
};
