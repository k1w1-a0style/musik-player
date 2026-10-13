import { hashString128 as hashString } from './stringHash';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { assertPersistenceEpoch, assertPersistenceWritable, capturePersistenceEpoch, trackPersistenceWork } from './persistenceMaintenance';
import { flushSongLibraryMaintenance, protectSongLibraryKeys, requestSongLibraryMaintenance,
  resetSongLibraryMaintenanceForTests, setActiveSongLibraryKeys, setSongLibraryLegacyPolicy,
  waitForSongLibraryDeletes } from './songLibraryMaintenance';

const SONG_LIBRARY_PREFIX = '@musikplayer:song-library:v2:';
export const SONG_LIBRARY_MANIFEST_KEY = `${SONG_LIBRARY_PREFIX}manifest`;
export const SONG_LIBRARY_CHUNK_PREFIX = `${SONG_LIBRARY_PREFIX}chunk:`;
export const MAX_SONG_LIBRARY_CHUNK_CODE_UNITS = 128 * 1024;
// UTF-16 code units: the serialized snapshot alone can occupy roughly 32 MiB.
// Budgets are checked before parsing, chunk allocation, native reads and joins.
export const MAX_SONG_LIBRARY_SERIALIZED_CODE_UNITS = 16 * 1024 * 1024;
export const MAX_SONG_LIBRARY_MANIFEST_CODE_UNITS = 512 * 1024;
export const MAX_SONG_LIBRARY_CHUNK_REFERENCES = 4096;

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
      if (chunks.length >= MAX_SONG_LIBRARY_CHUNK_REFERENCES) throw new SongLibraryStorageError(
        'Die Bibliothek überschreitet das Chunk-Budget. Der gespeicherte Bestand bleibt erhalten.',
      );
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

const hasManifestHeader = (candidate: Partial<SongLibraryManifest>): boolean =>
  candidate.version === 2
    && typeof candidate.revision === 'string'
    && candidate.revision.length <= 128
    && Number.isSafeInteger(candidate.serializedLength)
    && (candidate.serializedLength ?? -1) >= 0
    && (candidate.serializedLength ?? Infinity) <= MAX_SONG_LIBRARY_SERIALIZED_CODE_UNITS
    && isChecksum(candidate.checksum)
    && (candidate.legacyFallbackChecksum === undefined
      || isChecksum(candidate.legacyFallbackChecksum));

const isChunkReference = (chunk: SongLibraryManifest['chunks'][number]): boolean =>
  Boolean(chunk)
  && typeof chunk.key === 'string'
  && chunk.key.startsWith(SONG_LIBRARY_CHUNK_PREFIX)
  && chunk.key.length <= SONG_LIBRARY_CHUNK_PREFIX.length + 128
  && Number.isSafeInteger(chunk.length)
  && chunk.length >= 0
  && chunk.length <= MAX_SONG_LIBRARY_CHUNK_CODE_UNITS
  && isChecksum(chunk.checksum);

const isManifest = (value: unknown): value is SongLibraryManifest => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SongLibraryManifest>;
  return hasManifestHeader(candidate)
    && Array.isArray(candidate.chunks)
    && candidate.chunks.length > 0
    && candidate.chunks.length <= MAX_SONG_LIBRARY_CHUNK_REFERENCES
    && candidate.chunks.every(isChunkReference)
    && candidate.chunks.reduce((total, chunk) => total + chunk.length, 0) === candidate.serializedLength;
};

const isChecksum = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);
const assertSnapshotBudget = (raw: string): void => {
  if (raw.length > MAX_SONG_LIBRARY_SERIALIZED_CODE_UNITS) throw new SongLibraryStorageError(
    'Die Bibliothek ist zu groß für das Speicherbudget (16 Mio. Zeichen). Der gespeicherte Bestand bleibt erhalten.',
  );
};

const parseManifest = (raw: string | null): SongLibraryManifest | null => {
  if (!raw) return null;
  assertManifestBudget(raw);
  try {
    const parsed: unknown = JSON.parse(raw);
    return isManifest(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const assertManifestBudget = (raw: string): void => {
  if (raw.length > MAX_SONG_LIBRARY_MANIFEST_CODE_UNITS) throw new SongLibraryStorageError(
    'Das Bibliotheksmanifest ist zu groß. Der gespeicherte Bestand bleibt erhalten; bitte Daten prüfen.',
  );
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
    const manifestRaw = await AsyncStorage.getItem(SONG_LIBRARY_MANIFEST_KEY);
    const manifest = parseManifest(manifestRaw);
    if (manifest) {
      setActiveSongLibraryKeys([...manifest.chunks.map(chunk => chunk.key),
        ...(manifest.legacyFallbackChecksum ? [legacyKey] : [])]);
      try {
        return { source: 'chunked', serialized: await readManifestSnapshot(manifest) };
      } catch (error) {
        if (manifest.legacyFallbackChecksum == null) throw error;
        const legacyRaw = await AsyncStorage.getItem(legacyKey);
        if (legacyRaw != null
          && manifest.legacyFallbackChecksum != null
          && legacyRaw.length <= MAX_SONG_LIBRARY_SERIALIZED_CODE_UNITS
          && hashString(legacyRaw) === manifest.legacyFallbackChecksum) {
          return { source: 'legacy', serialized: legacyRaw };
        }
        throw error;
      }
    }
    if (manifestRaw != null) {
      throw new SongLibraryStorageError('Das Bibliotheksmanifest ist beschädigt oder überschreitet das Budget. Keine bestätigte Rückfallkopie verfügbar; der Bestand bleibt erhalten.');
    }
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (legacyRaw != null) assertSnapshotBudget(legacyRaw);
    return legacyRaw == null
      ? { source: 'missing', serialized: null }
      : { source: 'legacy', serialized: legacyRaw };
  });

let revisionSequence = 0;
const nextRevision = (): string =>
  `${Date.now().toString(36)}-${(++revisionSequence).toString(36)}`;

const prepareLibraryWrite = (serialized: string): { manifest: SongLibraryManifest; uniqueWrites: Map<string, string> } => {
  // Build and validate all references before performing any native I/O.
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

  const manifest: SongLibraryManifest = {
    version: 2, revision: nextRevision(), serializedLength: serialized.length,
    checksum: hashString(serialized), chunks: chunkReferences,
  };
  // Reserve the optional fixed-size checksum before reading the rollback copy.
  assertManifestBudget(JSON.stringify({ ...manifest, legacyFallbackChecksum: '0'.repeat(32) }));
  return { manifest, uniqueWrites };
};

const writeVerifiedChunks = async (uniqueWrites: Map<string, string>): Promise<void> => {
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
};

export const writeStoredSongLibrary = async (
  legacyKey: string,
  serialized: string,
  options: { removeLegacy?: boolean } = {},
): Promise<void> => {
  assertPersistenceWritable();
  assertSnapshotBudget(serialized);
  const owner = capturePersistenceEpoch();
  // A later migration protects the rollback key before any queued/native
  // deletion wait, and before an older cleanup can reserve that key.
  setSongLibraryLegacyPolicy(legacyKey, options.removeLegacy !== false);
  return trackPersistenceWork(runSerializedMutation(async () => {
    assertPersistenceEpoch(owner);
    const { manifest, uniqueWrites } = prepareLibraryWrite(serialized);
    const release = protectSongLibraryKeys([...uniqueWrites.keys(),
      ...(options.removeLegacy === false ? [legacyKey] : [])]);
    try {
      await waitForSongLibraryDeletes([...uniqueWrites.keys(),
        ...(options.removeLegacy === false ? [legacyKey] : [])]);
      assertPersistenceEpoch(owner);
      const legacyFallback = options.removeLegacy === false ? await AsyncStorage.getItem(legacyKey) : null;
      if (legacyFallback != null) {
        assertSnapshotBudget(legacyFallback);
        manifest.legacyFallbackChecksum = hashString(legacyFallback);
      }
      const serializedManifest = JSON.stringify(manifest);

      await writeVerifiedChunks(uniqueWrites);

      assertPersistenceEpoch(owner);
      await AsyncStorage.setItem(SONG_LIBRARY_MANIFEST_KEY, serializedManifest);
      setActiveSongLibraryKeys([...uniqueWrites.keys(), ...(manifest.legacyFallbackChecksum ? [legacyKey] : [])]);
      requestSongLibraryMaintenance();
    } finally { release(); }
  }));
};

export const removeStoredSongLibrary = async (legacyKey: string): Promise<void> => {
  assertPersistenceWritable();
  const owner = capturePersistenceEpoch();
  return trackPersistenceWork(runSerializedMutation(async () => {
    assertPersistenceEpoch(owner);
    // Optional cleanup must not delete the rollback key during this operation.
    const release = protectSongLibraryKeys([legacyKey]);
    try {
      await flushSongLibraryMaintenance();
      assertPersistenceEpoch(owner);
      // Enumerate before any destructive I/O: failure keeps legacy-only data.
      const keys = await AsyncStorage.getAllKeys();
      assertPersistenceEpoch(owner);
      const libraryKeys = keys.filter(key =>
        key === SONG_LIBRARY_MANIFEST_KEY
        || key.startsWith(SONG_LIBRARY_CHUNK_PREFIX),
      );
      if (libraryKeys.length > 0) {
        // Android AsyncStorage deletes the complete set in one SQLite transaction.
        // Never remove the rollback separately before a failed manifest/chunk delete.
        await AsyncStorage.multiRemove([legacyKey, ...libraryKeys]);
      } else {
        await AsyncStorage.removeItem(legacyKey);
      }
      setActiveSongLibraryKeys([]);
    } finally { release(); }
  }));
};

export const migrateLegacySongLibraryIfNeeded = async (
  legacyKey: string,
  normalizedSerialized: string,
  source: StoredSongLibrarySnapshot['source'],
): Promise<void> => {
  if (source !== 'legacy') return;
  await writeStoredSongLibrary(legacyKey, normalizedSerialized, { removeLegacy: false });
};

export const resetSongLibraryStorageForTests = (): void => {
  resetSongLibraryMaintenanceForTests();
  revisionSequence = 0;
  mutationQueue.current = Promise.resolve();
};
