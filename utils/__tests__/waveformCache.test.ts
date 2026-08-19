import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearWaveformCache,
  getCachedWaveform,
  peekCachedWaveform,
  resetWaveformCacheStateForTests,
  setCachedWaveform,
} from '../waveformCache';
import { WAVEFORM_VERSION, type SongWaveform, type WaveformSourceIdentity } from '../waveformTypes';

const PREFIX = '@musikplayer:waveform:v5:';
const INDEX_KEY = `${PREFIX}index`;
const storage = AsyncStorage as typeof AsyncStorage & {
  __reset(): void;
  __getStore(): Map<string, string>;
};
const originalSetItem = (AsyncStorage.setItem as jest.Mock).getMockImplementation();

const identityFor = (sourceKey: string, seed = 1): WaveformSourceIdentity => ({
  sourceKey,
  sourceFingerprint: `wf5:${seed.toString(16).padStart(32, '0')}`,
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
});

test('stores and reads a valid waveform', async () => {
  const waveform = waveformFor('source-1');
  await setCachedWaveform(waveform);
  await expect(getCachedWaveform(waveform)).resolves.toEqual(waveform);
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

test('clears indexed, orphaned and legacy waveform payloads', async () => {
  const waveform = waveformFor('source-1');
  await setCachedWaveform(waveform);
  await AsyncStorage.setItem(`${PREFIX}orphan`, JSON.stringify(waveformFor('orphan', 2)));
  await AsyncStorage.setItem('@musikplayer:waveform:legacy', '{}');

  await clearWaveformCache();

  const keys = await AsyncStorage.getAllKeys();
  expect(keys.filter(key => key.startsWith('@musikplayer:waveform:'))).toEqual([]);
});

test('serializes concurrent index updates without losing cache entries', async () => {
  const waveforms = ['a', 'b', 'c', 'd'].map((sourceKey, index) => waveformFor(sourceKey, index + 1));

  await Promise.all(waveforms.map(item => setCachedWaveform(item)));

  const rawIndex = await AsyncStorage.getItem(INDEX_KEY);
  expect(rawIndex).not.toBeNull();
  const indexedKeys = new Set((JSON.parse(rawIndex ?? '[]') as WaveformSourceIdentity[]).map(item => item.sourceKey));
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

  const index = JSON.parse(await AsyncStorage.getItem(INDEX_KEY) ?? '[]') as WaveformSourceIdentity[];
  expect(new Set(index.map(item => item.sourceKey))).toEqual(new Set(['orphan', 'current']));
  await expect(getCachedWaveform(orphan)).resolves.toEqual(orphan);
});

test('enforces the 80-entry LRU boundary at 79/80/81', async () => {
  const waveforms = Array.from({ length: 81 }, (_, index) => waveformFor(`source-${index}`, index + 1));
  for (const waveform of waveforms) await setCachedWaveform(waveform);

  const index = JSON.parse(await AsyncStorage.getItem(INDEX_KEY) ?? '[]') as WaveformSourceIdentity[];
  expect(index).toHaveLength(80);
  expect(index[0].sourceKey).toBe('source-80');
  expect(index.at(-1)?.sourceKey).toBe('source-1');
  await expect(AsyncStorage.getItem(`${PREFIX}source-0`)).resolves.toBeNull();
  await expect(getCachedWaveform(waveforms[80])).resolves.toEqual(waveforms[80]);
});

test('serializes clear behind an in-flight write', async () => {
  const waveform = waveformFor('raced');
  const write = setCachedWaveform(waveform);
  const clear = clearWaveformCache();
  await Promise.all([write, clear]);

  expect((await AsyncStorage.getAllKeys()).filter(key => key.startsWith('@musikplayer:waveform:'))).toEqual([]);
});
