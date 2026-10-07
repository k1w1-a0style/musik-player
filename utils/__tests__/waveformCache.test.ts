// eslint-disable-next-line @typescript-eslint/no-require-imports -- Isolated native filesystem test double.
jest.mock('expo-file-system/legacy', () => require('./waveformFileSystemMock'));
import { resetWaveformFileSystem, waveformFiles, readAsStringAsync, deleteAsync } from './waveformFileSystemMock';
beforeEach(() => resetWaveformFileSystem());

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCachedWaveform, getCachedWaveformAvailability, getWaveformCacheUsage, MAX_MEMORY_WAVEFORMS, MAX_MEMORY_WAVEFORM_BYTES,
  peekCachedWaveform,
  resetWaveformCacheStateForTests,
  setCachedWaveform,
} from '../waveformCache';
import { serializeWaveformManifest, waveformManifestEntry } from '../waveformCacheManifest';
import { WAVEFORM_VERSION, type SongWaveform, type WaveformSourceIdentity } from '../waveformTypes';

const PREFIX = '@musikplayer:waveform:v6:';
const INDEX_KEY = `${PREFIX}index`;
const storage = AsyncStorage as typeof AsyncStorage & {
  __reset(): void;
  __getStore(): Map<string, string>;
};
const originalSetItem = (AsyncStorage.setItem as jest.Mock).getMockImplementation();
const originalGetItem = (AsyncStorage.getItem as jest.Mock).getMockImplementation();
const originalMultiGet = (AsyncStorage.multiGet as jest.Mock).getMockImplementation();
const originalReadFile = readAsStringAsync.getMockImplementation();
const originalDeleteFile = deleteAsync.getMockImplementation();
const manifest = async () => JSON.parse(await AsyncStorage.getItem(INDEX_KEY) ?? '{"entries":[]}').entries as WaveformSourceIdentity[];

const identityFor = (sourceKey: string, seed = 1): WaveformSourceIdentity => ({
  sourceKey,
  sourceFingerprint: `wf6:${seed.toString(16).padStart(32, '0')}`,
});

const waveformFor = (sourceKey: string, seed = 1): SongWaveform => ({
  version: WAVEFORM_VERSION,
  points: [0.2, 0.7, 1],
  durationMs: 1000,
  ...identityFor(sourceKey, seed),
  source: 'native',
  generatedAt: seed,
});

beforeEach(() => {
  storage.__reset();
  resetWaveformCacheStateForTests();
  jest.clearAllMocks();
  (AsyncStorage.setItem as jest.Mock).mockImplementation(originalSetItem);
  (AsyncStorage.getItem as jest.Mock).mockImplementation(originalGetItem);
  (AsyncStorage.multiGet as jest.Mock).mockImplementation(originalMultiGet);
  readAsStringAsync.mockImplementation(originalReadFile!);
  deleteAsync.mockImplementation(originalDeleteFile!);
});

test('stores and reads a valid waveform', async () => {
  const waveform = waveformFor('source-1');
  await setCachedWaveform(waveform);
  await expect(getCachedWaveform(waveform)).resolves.toEqual(waveform);
});

test('unchanged finalized publications do not rewrite the durable manifest or reread a verified payload', async () => {
  const waveform = waveformFor('unchanged');
  await setCachedWaveform(waveform);
  const savedFiles = new Map(waveformFiles);
  jest.clearAllMocks();
  await setCachedWaveform({ ...waveform, points: [...waveform.points] });
  await setCachedWaveform(waveform);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(readAsStringAsync).not.toHaveBeenCalled();
  expect(waveformFiles).toEqual(savedFiles);
  await expect(getCachedWaveform(waveform)).resolves.toEqual(waveform);
});

test('an unchanged publication repairs a missing payload without rewriting its committed manifest', async () => {
  const waveform = waveformFor('missing-payload');
  await setCachedWaveform(waveform);
  waveformFiles.clear(); jest.clearAllMocks();
  await setCachedWaveform(waveform);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(waveformFiles.size).toBe(1);
  resetWaveformCacheStateForTests();
  await expect(getCachedWaveform(waveform)).resolves.toEqual(waveform);
});

test('loads a 1000-song manifest with one payload read and correct aggregate budgets', async () => {
  const waveforms = Array.from({ length: 1000 }, (_, index) => waveformFor(`budget-${index}`, index + 1));
  const entries = waveforms.map(waveform => {
    const raw = JSON.stringify(waveform); const entry = waveformManifestEntry(waveform, raw);
    waveformFiles.set(`file:///documents/waveforms/v6/${entry.fileName}`, raw);
    return entry;
  });
  await AsyncStorage.setItem(INDEX_KEY, serializeWaveformManifest(entries));
  jest.clearAllMocks();
  await expect(getCachedWaveform(waveforms[999])).resolves.toEqual(waveforms[999]);
  expect(readAsStringAsync).toHaveBeenCalledTimes(1);
  expect(getWaveformCacheUsage()).toMatchObject({
    persistedEntries: 1000,
    persistedBytes: waveforms.reduce((bytes, waveform) => bytes + Buffer.byteLength(JSON.stringify(waveform)), 0),
    memoryEntries: 1,
  });
  for (const waveform of waveforms) expect(getCachedWaveformAvailability(waveform).waveformAvailable).toBe(true);
  expect(readAsStringAsync).toHaveBeenCalledTimes(1);
  await setCachedWaveform({ ...waveforms[0], ...identityFor(waveforms[0].sourceKey, 1001) });
  expect(getCachedWaveformAvailability(waveforms[0]).waveformAvailable).toBe(false);
});

test('serves a finalized waveform synchronously from the bounded memory cache', async () => {
  const waveform = waveformFor('instant');
  expect(peekCachedWaveform(waveform)).toBeNull();

  const persistence = setCachedWaveform(waveform);

  expect(peekCachedWaveform(waveform)).toEqual(waveform);
  await persistence;
});

test('returns null for a missing waveform', async () => {
  await expect(getCachedWaveform(identityFor('missing'))).resolves.toBeNull();
});

test('rejects a primary-key collision when the independent fingerprint differs', async () => {
  const stored = waveformFor('collision-key', 1);
  await setCachedWaveform(stored);

  await expect(getCachedWaveform(identityFor('collision-key', 2))).resolves.toBeNull();
  await expect(getCachedWaveform(stored)).resolves.toEqual(stored);
});

test('invalidates legacy cache entries on first access', async () => {
  await AsyncStorage.setItem('@musikplayer:waveform:legacy-source', JSON.stringify({ version: 2 }));
  await getCachedWaveform(identityFor('current'));
  await expect(AsyncStorage.getItem('@musikplayer:waveform:legacy-source')).resolves.toBeNull();
});

test('serializes concurrent index updates without losing cache entries', async () => {
  const waveforms = ['a', 'b', 'c', 'd'].map((sourceKey, index) => waveformFor(sourceKey, index + 1));

  await Promise.all(waveforms.map(item => setCachedWaveform(item)));

  const rawIndex = await AsyncStorage.getItem(INDEX_KEY);
  expect(rawIndex).not.toBeNull();
  const indexedKeys = new Set((await manifest()).map(item => item.sourceKey));
  expect(indexedKeys).toEqual(new Set(['a', 'b', 'c', 'd']));
  await expect(Promise.all(waveforms.map(item => getCachedWaveform(item)))).resolves.toEqual(waveforms);
});

test('reuses the validated in-memory index instead of rescanning every cached payload', async () => {
  await setCachedWaveform(waveformFor('first'));
  const callsAfterFirstWrite = (AsyncStorage.getAllKeys as jest.Mock).mock.calls.length;

  await setCachedWaveform(waveformFor('second', 2));

  expect((AsyncStorage.getAllKeys as jest.Mock).mock.calls).toHaveLength(callsAfterFirstWrite);
});

test('rolls back a new payload when the authoritative index write fails', async () => {
  const waveform = waveformFor('broken');
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => {
    if (key === INDEX_KEY && value !== '[]') throw new Error('index unavailable');
    return originalSetItem?.(key, value);
  });

  await expect(setCachedWaveform(waveform)).rejects.toThrow('index unavailable');
  await expect(AsyncStorage.getItem(`${PREFIX}broken`)).resolves.toBeNull();
  expect(peekCachedWaveform(waveform)).toEqual(waveform);
});

test('a failed mutation does not poison later cache writes', async () => {
  const failed = waveformFor('broken');
  let rejectIndex = true;
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => {
    if (rejectIndex && key === INDEX_KEY && value !== '[]') {
      rejectIndex = false;
      throw new Error('storage unavailable');
    }
    return originalSetItem?.(key, value);
  });

  await expect(setCachedWaveform(failed)).rejects.toThrow('storage unavailable');
  const recovered = waveformFor('recovered', 2);
  await expect(setCachedWaveform(recovered)).resolves.toBeUndefined();
  await expect(getCachedWaveform(recovered)).resolves.toEqual(recovered);
});

test('reconstructs a corrupt index from validated payload records', async () => {
  const orphan = waveformFor('orphan', 1);
  await AsyncStorage.setItem(`${PREFIX}${orphan.sourceKey}`, JSON.stringify(orphan));
  await AsyncStorage.setItem(INDEX_KEY, '{corrupt');
  const current = waveformFor('current', 2);

  await setCachedWaveform(current);

  const index = await manifest();
  expect(new Set(index.map(item => item.sourceKey))).toEqual(new Set(['orphan', 'current']));
  await expect(getCachedWaveform(orphan)).resolves.toEqual(orphan);
});

test('preserves saved files when manifest recovery hits a transient read failure', async () => {
  const saved = waveformFor('saved');
  await setCachedWaveform(saved);
  resetWaveformCacheStateForTests();
  const savedFiles = new Map(waveformFiles);
  await AsyncStorage.setItem(INDEX_KEY, '{corrupt');
  const savedIndex = storage.__getStore().get(INDEX_KEY);
  readAsStringAsync.mockImplementation(async () => {
    throw new Error('temporary read failure');
  });

  await expect(setCachedWaveform(waveformFor('new', 2))).rejects.toThrow('temporary read failure');
  expect(waveformFiles).toEqual(savedFiles);
  expect(storage.__getStore().get(INDEX_KEY)).toBe(savedIndex);

  readAsStringAsync.mockImplementation(originalReadFile!);
  await setCachedWaveform(waveformFor('new', 2));
  resetWaveformCacheStateForTests();
  await expect(getCachedWaveform(saved)).resolves.toEqual(saved);
});

test('keeps more than 256 waveforms across restart while RAM remains bounded', async () => {
  const waveforms = Array.from({ length: 300 }, (_, index) => waveformFor(`source-${index}`, index + 1));
  for (const waveform of waveforms) await setCachedWaveform(waveform);
  expect(await manifest()).toHaveLength(300);
  expect(getWaveformCacheUsage().memoryEntries).toBeLessThanOrEqual(MAX_MEMORY_WAVEFORMS);
  expect(getWaveformCacheUsage().memoryBytes).toBeLessThanOrEqual(MAX_MEMORY_WAVEFORM_BYTES);
  expect(peekCachedWaveform(waveforms[0])).toBeNull();
  resetWaveformCacheStateForTests();
  await expect(getCachedWaveform(waveforms[0])).resolves.toEqual(waveforms[0]);
  await expect(getCachedWaveform(waveforms[299])).resolves.toEqual(waveforms[299]);
});

test('an ordinary cold manifest reads only the requested payload, without parsing every bass array', async () => {
  for (let index = 0; index < 20; index += 1) await setCachedWaveform(waveformFor(`source-${index}`, index + 1));
  resetWaveformCacheStateForTests();
  jest.clearAllMocks();
  await expect(getCachedWaveform(waveformFor('source-0'))).resolves.toMatchObject({ source: 'native' });
  expect(readAsStringAsync).toHaveBeenCalledTimes(1);
  expect(AsyncStorage.multiGet).not.toHaveBeenCalled();
  expect(AsyncStorage.getAllKeys).not.toHaveBeenCalled();
});

test('large bass envelopes also honor the RAM byte budget before the entry-count limit', async () => {
  const bass = Array<number>(24_000).fill(0.1);
  for (let index = 0; index < 60; index += 1) await setCachedWaveform({ ...waveformFor(`large-${index}`, index + 1), bassPoints: bass });
  const usage = getWaveformCacheUsage();
  expect(usage.memoryEntries).toBeLessThan(60);
  expect(usage.memoryBytes).toBeLessThanOrEqual(MAX_MEMORY_WAVEFORM_BYTES);
  expect(usage.persistedEntries).toBe(60);
});

test('migrates legacy database payloads without changing a single stored float', async () => {
  const saved = { ...waveformFor('legacy'), bassPoints: [0, 0.239183859825, 1] };
  await AsyncStorage.setItem(`${PREFIX}legacy`, JSON.stringify(saved));
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify([identityFor('legacy')]));
  await expect(getCachedWaveform(saved)).resolves.toEqual(saved);
  expect(waveformFiles.size).toBe(1);
  await expect(AsyncStorage.getItem(`${PREFIX}legacy`)).resolves.toBeNull();
  resetWaveformCacheStateForTests();
  await expect(getCachedWaveform(saved)).resolves.toEqual(saved);
});

test('keeps legacy copies when a migration manifest cannot commit and retries on restart', async () => {
  const saved = waveformFor('legacy');
  await AsyncStorage.setItem(`${PREFIX}legacy`, JSON.stringify(saved));
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify([identityFor('legacy')]));
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => {
    if (key === INDEX_KEY) throw new Error('disk full');
    return originalSetItem?.(key, value);
  });
  await expect(getCachedWaveform(saved)).resolves.toEqual(saved);
  await expect(AsyncStorage.getItem(`${PREFIX}legacy`)).resolves.toBe(JSON.stringify(saved));
  (AsyncStorage.setItem as jest.Mock).mockImplementation(originalSetItem);
  resetWaveformCacheStateForTests();
  await expect(getCachedWaveform(saved)).resolves.toEqual(saved);
  await expect(AsyncStorage.getItem(`${PREFIX}legacy`)).resolves.toBeNull();
});

test('an interrupted replacement leaves the previous committed file readable after restart', async () => {
  const original = waveformFor('same');
  await setCachedWaveform(original);
  const savedFiles = new Map(waveformFiles);
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => {
    if (key === INDEX_KEY) throw new Error('disk full');
    return originalSetItem?.(key, value);
  });
  await expect(setCachedWaveform({ ...original, points: [0.4, 0.5], generatedAt: 2 })).rejects.toThrow('disk full');
  expect(waveformFiles).toEqual(savedFiles);
  resetWaveformCacheStateForTests();
  await expect(getCachedWaveform(original)).resolves.toEqual(original);
});

test('detects a payload whose checksum or bass envelope was corrupted', async () => {
  const waveform = waveformFor('corrupt');
  await setCachedWaveform(waveform);
  const uri = [...waveformFiles.keys()][0];
  waveformFiles.set(uri, JSON.stringify({ ...waveform, bassPoints: [0, 2] }));
  resetWaveformCacheStateForTests();
  await expect(getCachedWaveform(waveform)).resolves.toBeNull();
});

test('reclaims an uncommitted immutable file after a crash without reading committed arrays', async () => {
  const waveform = waveformFor('saved');
  await setCachedWaveform(waveform);
  waveformFiles.set(`file:///documents/waveforms/v6/${'0'.repeat(32)}-${'1'.repeat(32)}.json`, '{interrupted');
  resetWaveformCacheStateForTests();
  jest.clearAllMocks();
  await expect(getCachedWaveform(waveform)).resolves.toEqual(waveform);
  expect(waveformFiles.size).toBe(1);
  expect(readAsStringAsync).toHaveBeenCalledTimes(1);
});

test('failed file retirement blocks further persistent growth until cleanup recovers', async () => {
  const waveform = waveformFor('first');
  await setCachedWaveform(waveform);
  deleteAsync.mockRejectedValue(new Error('filesystem busy'));
  await setCachedWaveform({ ...waveform, points: [0.3, 1], generatedAt: 2 });
  expect(getWaveformCacheUsage().pendingCleanupFiles).toBe(1);
  expect(waveformFiles.size).toBe(2);
  const next = waveformFor('next', 3);
  await expect(setCachedWaveform(next)).rejects.toThrow('retirement incomplete');
  expect(waveformFiles.size).toBe(2);
  expect(peekCachedWaveform(next)).toEqual(next);
  deleteAsync.mockImplementation(originalDeleteFile!);
  await setCachedWaveform(next);
  expect(getWaveformCacheUsage().pendingCleanupFiles).toBe(0);
  expect(waveformFiles.size).toBe(2);
  resetWaveformCacheStateForTests();
  await expect(getCachedWaveform(next)).resolves.toEqual(next);
});
