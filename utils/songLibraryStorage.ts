import AsyncStorage from '@react-native-async-storage/async-storage';

const SONG_LIBRARY_PREFIX = '@musikplayer:song-library:v2:';
export const SONG_LIBRARY_MANIFEST_KEY = `${SONG_LIBRARY_PREFIX}manifest`;
export const SONG_LIBRARY_CHUNK_PREFIX = `${SONG_LIBRARY_PREFIX}chunk:`;
export const MAX_SONG_LIBRARY_CHUNK_CODE_UNITS = 128 * 1024;

interface SongLibraryManifest {
  version: 2;
  revision: string;
  serializedLength: number;
  checksum: string;
  legacyFallbackChecksum?: string;
  chunks: Array<{
    key: string;
    length: number;
    checksum: string;
  }>;
}

export type StoredSongLibrarySnapshot =
  | { source: 'chunked' | 'legacy'; serialized: string }
  | { source: 'missing'; serialized: null };

export class SongLibraryStorageError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'SongLibraryStorageError';
  }
}

const hashString = (value: string): string => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  let h3 = 0xc0decafe;
  let h4 = 0x9e3779b9;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
    h3 = Math.imul(h3 ^ code, 2246822507);
    h4 = Math.imul(h4 ^ code, 3266489909);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1, h2, h3, h4].map(part => (part >>> 0).toString(16).padStart(8, '0')).join('');
};

const splitSerializedLibrary = (serialized: string): string[] => {
  if (serialized.length === 0) return [''];
  const chunks: string[] = [];
  for (let offset = 0; offset < serialized.length; offset += MAX_SONG_LIBRARY_CHUNK_CODE_UNITS) {
    chunks.push(serialized.slice(offset, offset + MAX_SONG_LIBRARY_CHUNK_CODE_UNITS));
  }
  return chunks;
};

const isManifest = (value: unknown): value is SongLibraryManifest => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SongLibraryManifest>;
  return candidate.version === 2
    && typeof candidate.revision === 'string'
    && Number.isSafeInteger(candidate.serializedLength)
    && (candidate.serializedLength ?? -1) >= 0
    && typeof candidate.checksum === 'string'
    && (candidate.legacyFallbackChecksum === undefined
      || typeof candidate.legacyFallbackChecksum === 'string')
    && Array.isArray(candidate.chunks)
    && candidate.chunks.length > 0
    && candidate.chunks.every(chunk =>
      Boolean(chunk)
      && typeof chunk.key === 'string'
      && chunk.key.startsWith(SONG_LIBRARY_CHUNK_PREFIX)
      && Number.isSafeInteger(chunk.length)
      && chunk.length >= 0
      && chunk.length <= MAX_SONG_LIBRARY_CHUNK_CODE_UNITS
      && typeof chunk.checksum === 'string',
    );
};

const parseManifest = (raw: string | null): SongLibraryManifest | null => {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isManifest(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const readManifestSnapshot = async (manifest: SongLibraryManifest): Promise<string> => {
  const uniqueKeys = [...new Set(manifest.chunks.map(chunk => chunk.key))];
  const storedChunks = new Map(await AsyncStorage.multiGet(uniqueKeys));
  const chunks = manifest.chunks.map(reference => {
    const value = storedChunks.get(reference.key);
    if (value == null || value.length !== reference.length || hashString(value) !== reference.checksum) {
      throw new SongLibraryStorageError('Song library chunk is missing or corrupt.');
    }
    return value;
  });
  const serialized = chunks.join('');
  if (serialized.length !== manifest.serializedLength || hashString(serialized) !== manifest.checksum) {
    throw new SongLibraryStorageError('Song library manifest checksum does not match its chunks.');
  }
  return serialized;
};

type SongLibraryMutationQueue = { current: Promise<void> };
const mutationQueue: SongLibraryMutationQueue = { current: Promise.resolve() };

const runSerializedMutation = async <T>(operation: () => Promise<T>): Promise<T> => {
  const previous = mutationQueue.current.catch(() => undefined);
  const next = previous.then(operation);
  mutationQueue.current = next.then(() => undefined, () => undefined);
  return next;
};

export const readStoredSongLibrary = async (
  legacyKey: string,
): Promise<StoredSongLibrarySnapshot> =>
  runSerializedMutation(async () => {
    const [manifestRaw, legacyRaw] = await Promise.all([
      AsyncStorage.getItem(SONG_LIBRARY_MANIFEST_KEY),
      AsyncStorage.getItem(legacyKey),
    ]);
    const manifest = parseManifest(manifestRaw);
    if (manifest) {
      try {
        return { source: 'chunked', serialized: await readManifestSnapshot(manifest) };
      } catch (error) {
        if (legacyRaw != null
          && manifest.legacyFallbackChecksum != null
          && hashString(legacyRaw) === manifest.legacyFallbackChecksum) {
          return { source: 'legacy', serialized: legacyRaw };
        }
        throw error;
      }
    }
    if (manifestRaw != null && legacyRaw == null) {
      throw new SongLibraryStorageError('Song library manifest is corrupt and no legacy fallback exists.');
    }
    return legacyRaw == null
      ? { source: 'missing', serialized: null }
      : { source: 'legacy', serialized: legacyRaw };
  });

let revisionSequence = 0;
const nextRevision = (): string =>
  `${Date.now().toString(36)}-${(++revisionSequence).toString(36)}`;

const cleanupUnreferencedChunks = async (activeKeys: ReadonlySet<string>): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const stale = keys.filter(key => key.startsWith(SONG_LIBRARY_CHUNK_PREFIX) && !activeKeys.has(key));
    if (stale.length > 0) await Promise.all(stale.map(key => AsyncStorage.removeItem(key)));
  } catch {
    // The committed manifest remains valid. Orphans are retried after a later successful write.
  }
};

export const writeStoredSongLibrary = async (
  legacyKey: string,
  serialized: string,
  options: { removeLegacy?: boolean } = {},
): Promise<void> =>
  runSerializedMutation(async () => {
    const legacyFallback = options.removeLegacy === false
      ? await AsyncStorage.getItem(legacyKey)
      : null;
    const chunkValues = splitSerializedLibrary(serialized);
    const chunkReferences = chunkValues.map(value => {
      const checksum = hashString(value);
      return {
        key: `${SONG_LIBRARY_CHUNK_PREFIX}${checksum}`,
        length: value.length,
        checksum,
      };
    });
    const uniqueWrites = new Map<string, string>();
    chunkReferences.forEach((reference, index) => uniqueWrites.set(reference.key, chunkValues[index]));

    const existing = new Map(await AsyncStorage.multiGet([...uniqueWrites.keys()]));
    const missingOrInvalid = [...uniqueWrites.entries()].filter(([key, value]) =>
      existing.get(key) !== value,
    );
    if (missingOrInvalid.length > 0) await AsyncStorage.multiSet(missingOrInvalid);

    const verified = new Map(await AsyncStorage.multiGet([...uniqueWrites.keys()]));
    const failedVerification = [...uniqueWrites.entries()].some(([key, value]) => verified.get(key) !== value);
    if (failedVerification) throw new SongLibraryStorageError('Song library chunks could not be verified before commit.');

    const manifest: SongLibraryManifest = {
      version: 2,
      revision: nextRevision(),
      serializedLength: serialized.length,
      checksum: hashString(serialized),
      ...(legacyFallback == null ? {} : { legacyFallbackChecksum: hashString(legacyFallback) }),
      chunks: chunkReferences,
    };
    await AsyncStorage.setItem(SONG_LIBRARY_MANIFEST_KEY, JSON.stringify(manifest));

    if (options.removeLegacy !== false) {
      await AsyncStorage.removeItem(legacyKey).catch(() => undefined);
    }
    await cleanupUnreferencedChunks(new Set(chunkReferences.map(chunk => chunk.key)));
  });

export const removeStoredSongLibrary = async (legacyKey: string): Promise<void> =>
  runSerializedMutation(async () => {
    await AsyncStorage.removeItem(legacyKey);
    const keys = await AsyncStorage.getAllKeys();
    const libraryKeys = keys.filter(key =>
      key === SONG_LIBRARY_MANIFEST_KEY
      || key.startsWith(SONG_LIBRARY_CHUNK_PREFIX),
    );
    if (libraryKeys.length > 0) {
      await Promise.all(libraryKeys.map(key => AsyncStorage.removeItem(key)));
    }
  });

export const migrateLegacySongLibraryIfNeeded = async (
  legacyKey: string,
  normalizedSerialized: string,
  source: StoredSongLibrarySnapshot['source'],
): Promise<void> => {
  if (source !== 'legacy') return;
  await writeStoredSongLibrary(legacyKey, normalizedSerialized, { removeLegacy: false });
};

export const resetSongLibraryStorageForTests = (): void => {
  revisionSequence = 0;
  mutationQueue.current = Promise.resolve();
};
