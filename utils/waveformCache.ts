import AsyncStorage from '@react-native-async-storage/async-storage';
import { setWaveformStatus, resetWaveformStatusForTests } from './waveformStatus';
import { hashString128 } from './stringHash';
import {
  ensureWaveformDirectory, listWaveformFiles, readWaveformFile, writeWaveformFile,
  removeWaveformFile, waveformFileExists,
} from './waveformFileStore';
import {
  fitWaveformManifest, MAX_WAVEFORM_PAYLOAD_BYTES, parseWaveformManifest,
  serializeWaveformManifest, waveformManifestEntry, type WaveformManifestEntry,
} from './waveformCacheManifest';
import { isSongWaveform, isWaveformSourceIdentity, WAVEFORM_VERSION,
  type SongWaveform, type WaveformSourceIdentity } from './waveformTypes';

export { MAX_PERSISTED_WAVEFORM_BYTES } from './waveformCacheManifest';
const LEGACY_PREFIX = '@musikplayer:waveform:';
const PREFIX = `${LEGACY_PREFIX}v${WAVEFORM_VERSION}:`;
const INDEX_KEY = `${PREFIX}index`;
export const MAX_MEMORY_WAVEFORMS = 80;
export const MAX_MEMORY_WAVEFORM_BYTES = 8 * 1024 * 1024;
let cacheMutationQueue = Promise.resolve();
let cacheInitialization: Promise<void> | null = null;
let cachedIndex: WaveformManifestEntry[] = [];
const indexedWaveforms = new Map<string, WaveformManifestEntry>();
const verifiedPayloads = new Set<string>();
const memoryWaveforms = new Map<string, SongWaveform>();
const unavailablePayloads = new Set<string>();
const cleanupPending = new Set<string>();
let memoryBytes = 0;
let persistedBytes = 0;

const sameIdentity = (left: WaveformSourceIdentity, right: WaveformSourceIdentity): boolean =>
  left.sourceKey === right.sourceKey && left.sourceFingerprint === right.sourceFingerprint;
const indexedWaveform = (identity: WaveformSourceIdentity): WaveformManifestEntry | undefined => {
  const entry = indexedWaveforms.get(identity.sourceKey);
  return entry && sameIdentity(entry, identity) ? entry : undefined;
};
const manifestUnchanged = (entry: WaveformManifestEntry, replaced?: WaveformSourceIdentity): boolean => {
  const committed = indexedWaveform(entry);
  const replacement = replaced && indexedWaveform(replaced);
  return Boolean(committed && committed.fileName === entry.fileName && committed.bytes === entry.bytes
    && committed.hasBass === entry.hasBass && committed.source === entry.source && committed.generatedAt === entry.generatedAt
    && (!replacement || replacement.fileName === entry.fileName));
};
const forgetReplacedMemory = (identity: WaveformSourceIdentity, replaced?: WaveformSourceIdentity): void => {
  if (!replaced || replaced.sourceKey === identity.sourceKey) return;
  const memory = memoryWaveforms.get(replaced.sourceKey);
  if (memory && sameIdentity(memory, replaced)) forgetMemory(replaced.sourceKey);
};
const publishIndex = (entries: WaveformManifestEntry[]): void => {
  cachedIndex = entries; indexedWaveforms.clear(); persistedBytes = 0;
  for (const entry of entries) { indexedWaveforms.set(entry.sourceKey, entry); persistedBytes += entry.bytes; }
};
const memorySize = (waveform: SongWaveform): number =>
  (waveform.points.length + (waveform.bassPoints?.length ?? 0)) * 8 + 512;
const forgetMemory = (sourceKey: string): void => {
  const existing = memoryWaveforms.get(sourceKey);
  if (existing) memoryBytes -= memorySize(existing);
  memoryWaveforms.delete(sourceKey);
};
const markUnavailableIfEvicted = (identity: WaveformSourceIdentity): void => {
  if (!memoryWaveforms.has(identity.sourceKey) && !indexedWaveform(identity))
    setWaveformStatus(identity.sourceFingerprint, 'pending');
};
const rememberWaveform = (waveform: SongWaveform): void => {
  forgetMemory(waveform.sourceKey);
  memoryWaveforms.set(waveform.sourceKey, waveform);
  memoryBytes += memorySize(waveform);
  if (waveform.source === 'native') setWaveformStatus(waveform.sourceFingerprint, 'ready');
  while (memoryWaveforms.size > MAX_MEMORY_WAVEFORMS || memoryBytes > MAX_MEMORY_WAVEFORM_BYTES) {
    const oldestSourceKey = memoryWaveforms.keys().next().value as string | undefined;
    if (!oldestSourceKey) break;
    const evicted = memoryWaveforms.get(oldestSourceKey)!;
    forgetMemory(oldestSourceKey);
    markUnavailableIfEvicted(evicted);
  }
};

export const peekCachedWaveform = (identity: WaveformSourceIdentity): SongWaveform | null => {
  if (!isWaveformSourceIdentity(identity)) return null;
  const waveform = memoryWaveforms.get(identity.sourceKey);
  if (!waveform || !sameIdentity(waveform, identity)) return null;
  rememberWaveform(waveform);
  return waveform;
};

/** Manifest availability and analysis completion are separate contracts. */
export const getCachedWaveformAvailability = (identity: WaveformSourceIdentity) => {
  const memory = memoryWaveforms.get(identity.sourceKey);
  const entry = indexedWaveform(identity);
  const native = memory && sameIdentity(memory, identity) && memory.source === 'native';
  const durable = entry?.source === 'native' && !unavailablePayloads.has(identity.sourceFingerprint);
  return {
    waveformAvailable: Boolean(native || durable),
    bassAvailable: Boolean(native ? memory.bassPoints?.length : durable && entry?.hasBass),
  };
};

const parseStoredWaveform = (raw: string | null): SongWaveform | null => {
  if (!raw || raw.length > MAX_WAVEFORM_PAYLOAD_BYTES) return null;
  try { const parsed = JSON.parse(raw); return isSongWaveform(parsed) ? parsed : null; }
  catch { return null; }
};
const writeIndex = (entries: WaveformManifestEntry[]): Promise<void> =>
  AsyncStorage.setItem(INDEX_KEY, serializeWaveformManifest(entries));
const retireFiles = async (names: string[]): Promise<void> => {
  for (let offset = 0; offset < names.length; offset += 32) {
    await Promise.all(names.slice(offset, offset + 32).map(async name => {
      try { await removeWaveformFile(name); cleanupPending.delete(name); verifiedPayloads.delete(name); }
      catch { cleanupPending.add(name); }
    }));
  }
};

const stageWaveform = async (
  waveform: SongWaveform, raw = JSON.stringify(waveform), entry = waveformManifestEntry(waveform, raw),
): Promise<WaveformManifestEntry> => {
  if (entry.bytes > MAX_WAVEFORM_PAYLOAD_BYTES) throw new Error('Waveform payload exceeds byte budget');
  if (await waveformFileExists(entry.fileName)) {
    if (verifiedPayloads.has(entry.fileName) || await readWaveformFile(entry.fileName) === raw) {
      verifiedPayloads.add(entry.fileName); return entry;
    }
  }
  await writeWaveformFile(entry.fileName, raw);
  if (hashString128(await readWaveformFile(entry.fileName)) !== entry.checksum)
    throw new Error('Waveform payload verification failed');
  verifiedPayloads.add(entry.fileName);
  return entry;
};

const readRecoverableFiles = async (fileNames: string[]): Promise<Map<string, WaveformManifestEntry>> => {
  const stored = new Map<string, WaveformManifestEntry>();
  for (const fileName of fileNames) {
    // A transient read failure aborts before deleting or retiring any old data.
    const raw = await readWaveformFile(fileName);
    const waveform = parseStoredWaveform(raw);
    const entry = waveform ? waveformManifestEntry(waveform, raw) : null;
    if (!entry || entry.fileName !== fileName) continue;
    const prior = stored.get(entry.sourceKey);
    if (!prior || entry.generatedAt > prior.generatedAt) stored.set(entry.sourceKey, entry);
  }
  return stored;
};
const migrateLegacyFiles = async (legacyKeys: string[], stored: Map<string, WaveformManifestEntry>): Promise<Set<string>> => {
  const stagedFiles = new Set<string>();
  for (let offset = 0; offset < legacyKeys.length; offset += 32) {
    const records = await AsyncStorage.multiGet(legacyKeys.slice(offset, offset + 32));
    for (const [key, raw] of records) {
      const waveform = parseStoredWaveform(raw);
      if (!waveform || key !== `${PREFIX}${waveform.sourceKey}`) continue;
      const prior = stored.get(waveform.sourceKey);
      if (!prior || waveform.generatedAt > prior.generatedAt) {
        const entry = await stageWaveform(waveform);
        stored.set(waveform.sourceKey, entry); stagedFiles.add(entry.fileName);
      }
    }
  }
  return stagedFiles;
};
const orderRecoveredEntries = (rawIndex: string | null, stored: Map<string, WaveformManifestEntry>): WaveformManifestEntry[] => {
  let preferred: WaveformSourceIdentity[] = [];
  try { const parsed = JSON.parse(rawIndex ?? 'null'); if (Array.isArray(parsed)) preferred = parsed.filter(isWaveformSourceIdentity); }
  catch { /* Recover from the validated records instead. */ }
  const ordered: WaveformManifestEntry[] = [];
  for (const identity of preferred) {
    const entry = stored.get(identity.sourceKey);
    if (!entry || !sameIdentity(identity, entry)) continue;
    ordered.push(entry); stored.delete(entry.sourceKey);
  }
  return [...ordered, ...[...stored.values()].sort((a, b) => b.generatedAt - a.generatedAt)];
};
/** Recovery/migration only. A valid manifest never loads all saved float arrays. */
const recoverIndex = async (rawIndex: string | null): Promise<WaveformManifestEntry[]> => {
  const fileNames = await listWaveformFiles();
  const stored = await readRecoverableFiles(fileNames);
  const legacyKeys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(LEGACY_PREFIX) && key !== INDEX_KEY);
  const stagedFiles = await migrateLegacyFiles(legacyKeys, stored);
  const { active } = fitWaveformManifest(orderRecoveredEntries(rawIndex, stored));
  if (rawIndex || fileNames.length || legacyKeys.length || active.length) await writeIndex(active);
  // Only after the new manifest is durable can legacy copies be retired.
  await Promise.all(legacyKeys.map(key => AsyncStorage.removeItem(key).catch(() => undefined)));
  const kept = new Set(active.map(entry => entry.fileName));
  const orphaned = new Set([...fileNames, ...stagedFiles]);
  await retireFiles([...orphaned].filter(name => !kept.has(name)));
  return active;
};

const initializeCache = async (): Promise<void> => {
  if (!cacheInitialization) {
    cacheInitialization = (async () => {
      await ensureWaveformDirectory();
      const raw = await AsyncStorage.getItem(INDEX_KEY);
      const manifest = parseWaveformManifest(raw);
      let entries = manifest ?? await recoverIndex(raw);
      if (manifest) {
        // Reclaim incomplete writes after a crash using filenames only. Never
        // parse every bass/waveform payload on an ordinary process restart.
        const kept = new Set(manifest.map(entry => entry.fileName));
        const files = await listWaveformFiles();
        const present = new Set(files);
        entries = manifest.filter(entry => present.has(entry.fileName));
        await retireFiles(files.filter(name => !kept.has(name)));
      }
      publishIndex(entries);
    })().catch(error => { cacheInitialization = null; throw error; });
  }
  await cacheInitialization;
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
  try {
    await initializeCache();
    const entry = indexedWaveform(identity);
    if (!entry) return null;
    const raw = await readWaveformFile(entry.fileName);
    // A decoder may have published a newer final shape while a slow read was
    // pending. That late read must not replace its waveform or bass envelope.
    const published = peekCachedWaveform(identity);
    if (published) return published;
    const waveform = hashString128(raw) === entry.checksum ? parseStoredWaveform(raw) : null;
    if (!waveform || !sameIdentity(waveform, identity)) {
      verifiedPayloads.delete(entry.fileName);
      unavailablePayloads.add(identity.sourceFingerprint);
      setWaveformStatus(identity.sourceFingerprint, 'pending');
      return null;
    }
    verifiedPayloads.add(entry.fileName);
    rememberWaveform(waveform);
    return waveform;
  } catch {
    // Keep an older database copy usable if migration encounters full storage
    // or a transient filesystem error. It remains intact until commit succeeds.
    const raw = await AsyncStorage.getItem(`${PREFIX}${identity.sourceKey}`).catch(() => null);
    const legacy = parseStoredWaveform(raw);
    if (!legacy || !sameIdentity(legacy, identity)) return null;
    rememberWaveform(legacy);
    return legacy;
  }
};

export const setCachedWaveform = async (waveform: SongWaveform, replaced?: WaveformSourceIdentity): Promise<void> => {
  if (!isSongWaveform(waveform)) return;
  // Publish to remounts before I/O; a storage failure must not trigger another
  // decoder in the same session or discard an already visible final shape.
  rememberWaveform(waveform);
  await runCacheMutation(async () => {
    await initializeCache();
    // A failed deletion must not turn a byte-bounded store into unlimited disk
    // growth. Retry retirement before accepting another persistent payload.
    await retireFiles([...cleanupPending]);
    if (cleanupPending.size) throw new Error('Waveform file retirement incomplete');
    const raw = JSON.stringify(waveform);
    const planned = waveformManifestEntry(waveform, raw);
    const existed = await waveformFileExists(planned.fileName);
    try {
      const entry = await stageWaveform(waveform, raw, planned);
      if (manifestUnchanged(entry, replaced)) {
        unavailablePayloads.delete(waveform.sourceFingerprint);
        forgetReplacedMemory(waveform, replaced);
        return;
      }
      const remaining = cachedIndex.filter(item => item.sourceKey !== waveform.sourceKey
        && (!replaced || !sameIdentity(item, replaced)));
      const { active } = fitWaveformManifest([entry, ...remaining]);
      await writeIndex(active);
      const kept = new Set(active.map(item => item.fileName));
      const retired = cachedIndex.filter(item => !kept.has(item.fileName));
      publishIndex(active);
      unavailablePayloads.delete(waveform.sourceFingerprint);
      await retireFiles(retired.map(item => item.fileName));
      retired.forEach(markUnavailableIfEvicted);
      forgetReplacedMemory(waveform, replaced);
    } catch (error) {
      // Immutable content filenames leave the previous committed payload intact.
      if (!existed) await retireFiles([planned.fileName]);
      throw error;
    }
  });
};

/** Diagnostics expose aggregate budgets, never source URIs or song payloads. */
export const getWaveformCacheUsage = () => ({
  memoryEntries: memoryWaveforms.size, memoryBytes,
  persistedEntries: cachedIndex.length, persistedBytes,
  pendingCleanupFiles: cleanupPending.size,
});
export const resetWaveformCacheStateForTests = (): void => {
  cacheMutationQueue = Promise.resolve(); cacheInitialization = null; publishIndex([]); verifiedPayloads.clear();
  memoryWaveforms.clear(); unavailablePayloads.clear(); cleanupPending.clear(); memoryBytes = 0; resetWaveformStatusForTests();
};
