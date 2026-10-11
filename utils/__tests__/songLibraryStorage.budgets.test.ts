import AsyncStorage from '@react-native-async-storage/async-storage';
import { hashString128 } from '../stringHash';
import { readStoredSongLibrary, writeStoredSongLibrary, resetSongLibraryStorageForTests,
  SONG_LIBRARY_CHUNK_PREFIX, SONG_LIBRARY_MANIFEST_KEY } from '../songLibraryStorage';

const legacyKey = '@musikplayer:songs';
const maxSerialized = 16 * 1024 * 1024;
const maxManifest = 512 * 1024;
const checksum = hashString128('[]');
const chunk = { key: `${SONG_LIBRARY_CHUNK_PREFIX}${checksum}`, length: 2, checksum };
const manifest = () => ({ version: 2, revision: 'bounded', serializedLength: 2, checksum, chunks: [chunk] });

beforeEach(() => { (AsyncStorage as unknown as { __reset(): void }).__reset(); resetSongLibraryStorageForTests(); jest.clearAllMocks(); });
afterEach(() => jest.restoreAllMocks());

test.each(['declared-total', 'reference-count', 'length-sum', 'oversized-manifest'] as const)(
  'rejects %s before chunk reads or reconstruction', async kind => {
    const value = manifest();
    if (kind === 'declared-total') value.serializedLength = maxSerialized + 1;
    if (kind === 'reference-count') value.chunks = Array.from({ length: 4097 }, () => chunk);
    if (kind === 'length-sum') value.serializedLength = 3;
    let raw = JSON.stringify(value);
    if (kind === 'oversized-manifest') raw += ' '.repeat(maxManifest);
    await AsyncStorage.setItem(SONG_LIBRARY_MANIFEST_KEY, raw);
    await AsyncStorage.setItem(chunk.key, '[]');
    const parse = jest.spyOn(JSON, 'parse');
    const read = jest.spyOn(AsyncStorage, 'multiGet');
    let rejected = false;
    try { await readStoredSongLibrary(legacyKey); } catch { rejected = true; }
    const chunkReads = read.mock.calls.length;
    const manifestParses = parse.mock.calls.filter(([input]) => input === raw).length;
    // eslint-disable-next-line no-console -- Resource-boundary counters for deliberately invalid fixtures.
    console.info(JSON.stringify({ scope: 'host storage boundary; invalid metadata fixture', kind, chunkReads, manifestParses, rejected }));
    expect(rejected).toBe(true);
    expect(chunkReads).toBe(0);
    if (kind === 'oversized-manifest') expect(manifestParses).toBe(0);
  });

test('rejects an oversized write before I/O and keeps the committed library', async () => {
  await writeStoredSongLibrary(legacyKey, '[]');
  jest.clearAllMocks();
  await expect(writeStoredSongLibrary(legacyKey, 'x'.repeat(maxSerialized + 1))).rejects.toThrow(/groß|budget/i);
  expect(AsyncStorage.multiGet).not.toHaveBeenCalled();
  expect(AsyncStorage.multiSet).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  await expect(readStoredSongLibrary(legacyKey)).resolves.toEqual({ source: 'chunked', serialized: '[]' });
});

test('rejects oversized legacy data without parsing, hashing or deleting it', async () => {
  const raw = 'x'.repeat(maxSerialized + 1);
  await AsyncStorage.setItem(legacyKey, raw);
  const parse = jest.spyOn(JSON, 'parse');
  await expect(readStoredSongLibrary(legacyKey)).rejects.toThrow(/groß|budget/i);
  expect(parse).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(legacyKey)).toBe(raw);
});

test('ignores an oversized unused legacy copy when the committed bounded snapshot is valid', async () => {
  await writeStoredSongLibrary(legacyKey, '[]');
  await AsyncStorage.setItem(legacyKey, 'x'.repeat(maxSerialized + 1));
  await expect(readStoredSongLibrary(legacyKey)).resolves.toEqual({ source: 'chunked', serialized: '[]' });
  expect(AsyncStorage.getItem).not.toHaveBeenLastCalledWith(legacyKey);
});

test('does not resurrect unverified stale legacy data after an invalid manifest', async () => {
  await AsyncStorage.setItem(legacyKey, '[{"id":"old"}]');
  await AsyncStorage.setItem(SONG_LIBRARY_MANIFEST_KEY, JSON.stringify({ ...manifest(), serializedLength: maxSerialized + 1 }));
  await expect(readStoredSongLibrary(legacyKey)).rejects.toThrow();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(legacyKey)).toBe('[{"id":"old"}]');
});
