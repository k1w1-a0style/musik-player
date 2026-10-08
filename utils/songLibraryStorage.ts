import { hashString128 as hashString } from './stringHash';
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

// An ID anchor averages one boundary per 64 records. Unlike byte offsets or
// groups of a fixed number of songs, it survives edits and earlier insertions.
const SONG_CHUNK_ANCHOR_MASK = 63;
const LEADING_SONG_ID = /\{"id":("(?:\\.|[^"\\])*")/y;

const songIdAnchorHash = (id: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  }
  return hash;
};

const isSongChunkAnchor = (serialized: string, start: number, end: number): boolean => {
  try {
    // Normalized songs put id first. Read only that small JSON string, without
    // allocating/parsing a second copy of every title and artwork field.
    LEADING_SONG_ID.lastIndex = start;
    const leading = LEADING_SONG_ID.exec(serialized);
    const value: unknown = leading ? { id: JSON.parse(leading[1]) } : JSON.parse(serialized.slice(start, end));
    if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string') return false;
    // Anchors only partition bytes; identity and corruption protection still
    // use the original IDs and the unchanged 128-bit chunk/manifest checksum.
    return (songIdAnchorHash(value.id) & SONG_CHUNK_ANCHOR_MASK) === 0;
  } catch {
    return false;
  }
};

const boundedChunkEnd = (serialized: string, offset: number, end: number): number => {
  const chunkEnd = Math.min(end, offset + MAX_SONG_LIBRARY_CHUNK_CODE_UNITS);
  // AsyncStorage crosses an UTF-8 boundary: either surrogate half must not be
  // replaced before reconstruction, so keep the pair in one stored value.
  return chunkEnd < end
    && /[\uD800-\uDBFF]/.test(serialized[chunkEnd - 1])
    && /[\uDC00-\uDFFF]/.test(serialized[chunkEnd])
    ? chunkEnd - 1 : chunkEnd;
};

const jsonStringEnd = (serialized: string, start: number): number => {
  let end = serialized.indexOf('"', start + 1);
  while (end >= 0) {
    let beforeEscape = end - 1;
    while (serialized[beforeEscape] === '\\') beforeEscape -= 1;
    if ((end - beforeEscape) % 2 === 1) return end;
    end = serialized.indexOf('"', end + 1);
  }
  return serialized.length;
};

const visitSongChunkAnchors = (serialized: string, onAnchor: (end: number) => void): void => {
  if (serialized[0] !== '[') return;
  let depth = 1;
  let recordStart = 1;
  for (let index = 1; index < serialized.length; index += 1) {
    const character = serialized[index];
    // Skip long title/artwork values with the native string search instead of
    // visiting every code unit in JS; escaped quotes still stay inside strings.
    if (character === '"') index = jsonStringEnd(serialized, index);
    else if ('[{'.includes(character)) depth += 1;
    else if (']}'.includes(character)) depth -= 1;
    else if (character === ',' && depth === 1) {
      if (isSongChunkAnchor(serialized, recordStart, index)) onAnchor(index + 1);
      recordStart = index + 1;
    }
  }
};

const splitSerializedLibrary = (serialized: string): string[] => {
  if (serialized.length === 0) return [''];
  const chunks: string[] = [];
  let offset = 0;
  const emitThrough = (end: number): void => {
    while (offset < end) {
      const chunkEnd = boundedChunkEnd(serialized, offset, end);
      chunks.push(serialized.slice(offset, chunkEnd));
      offset = chunkEnd;
    }
  };

  // Scan only the outer array separators; strings and nested JSON values can
  // contain commas and brackets. Keep slices verbatim for v2 compatibility.
  visitSongChunkAnchors(serialized, emitThrough);
  // Huge records, non-array legacy values and malformed JSON remain bounded
  // and exactly reproducible. Their interpretation belongs to storage.ts.
  emitThrough(serialized.length);
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
    if (stale.length > 0) await AsyncStorage.multiRemove(stale);
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

    // Existing content was already read and compared byte for byte. Only new
    // writes need a readback; all manifest references stay verified at commit.
    const verified = missingOrInvalid.length > 0
      ? new Map(await AsyncStorage.multiGet(missingOrInvalid.map(([key]) => key)))
      : existing;
    const failedVerification = missingOrInvalid.some(([key, value]) => verified.get(key) !== value);
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
      await AsyncStorage.multiRemove(libraryKeys);
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
