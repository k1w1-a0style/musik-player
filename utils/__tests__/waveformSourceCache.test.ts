// eslint-disable-next-line @typescript-eslint/no-require-imports -- Isolated native filesystem test double.
jest.mock('expo-file-system/legacy', () => require('./waveformFileSystemMock'));
import { waveformFiles, resetWaveformFileSystem } from './waveformFileSystemMock';
beforeEach(() => resetWaveformFileSystem());

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Song } from '../../types/Song';
import { useSongPreparation } from '../../hooks/useSongPreparation';
import { getCachedWaveformForSong } from '../waveformSourceCache';
import { getCachedWaveform, peekCachedWaveform, resetWaveformCacheStateForTests, setCachedWaveform } from '../waveformCache';
import { getWaveformSourceIdentity } from '../waveformGenerator';
import { getSongAnalysisState, getSongPreparationStatus } from '../songPreparation';
import { loadPreparedSources, markSongPrepared, resetSongPreparationForTests, wasSongPrepared } from '../songPreparationStore';
import type { SongWaveform } from '../waveformTypes';

const song: Song = {
  id: 's1', title: 'Song', artist: 'Artist', uri: 'file:///music/song.mp3',
  duration: 123000, fileInfo: { size: 4096, importedAt: 42 },
};
// Independently recorded from c3fcb83; do not derive the old key from new code.
const legacy: SongWaveform = {
  version: 6, sourceKey: '124gn3b', sourceFingerprint: 'wf6:a3629b022cb16c0fc4c81f83e0912412',
  points: [0.04, 0.88, 0.12, 0.76, 0.2, 0.92, 0.34, 0.68],
  durationMs: 123000, generatedAt: 1000, source: 'native',
};
const key = (sourceKey: string) => `@musikplayer:waveform:v6:${sourceKey}`;
const indexKey = '@musikplayer:waveform:v6:index';

beforeEach(async () => {
  resetWaveformCacheStateForTests(); resetSongPreparationForTests();
  await AsyncStorage.clear();
});
afterEach(() => { jest.restoreAllMocks(); resetWaveformCacheStateForTests(); resetSongPreparationForTests(); });

test('migrates an exact legacy shape durably without changing its points, duration or timestamp', async () => {
  await setCachedWaveform(legacy);
  resetWaveformCacheStateForTests();
  const identity = getWaveformSourceIdentity(song);
  const migrated = await getCachedWaveformForSong(song);
  expect(migrated).toEqual({ ...legacy, ...identity });
  await waitFor(() => expect([...waveformFiles.values()].some(raw => JSON.parse(raw).sourceKey === legacy.sourceKey)).toBe(false));
  resetWaveformCacheStateForTests();
  expect(await getCachedWaveformForSong({ ...song, duration: 124000 })).toEqual(migrated);
  expect(JSON.parse((await AsyncStorage.getItem(indexKey))!).entries).toEqual([expect.objectContaining(identity)]);
});

test('finds an old audio-info duration after the top-level duration was corrected', async () => {
  await setCachedWaveform(legacy);
  expect(await getCachedWaveformForSong({ ...song, duration: 124000, audioInfo: { durationMs: 123000 } }))
    .toEqual({ ...legacy, ...getWaveformSourceIdentity(song) });
  await waitFor(() => expect([...waveformFiles.values()].some(raw => JSON.parse(raw).sourceKey === legacy.sourceKey)).toBe(false));
});

test.each([
  { ...song, uri: 'file:///different.mp3' },
  { ...song, fileInfo: { ...song.fileInfo, size: 8192 } },
  { ...song, fileInfo: { ...song.fileInfo, importedAt: 43 } },
])('does not reuse a legacy shape for a changed physical source: %j', async changed => {
  await setCachedWaveform(legacy);
  expect(await getCachedWaveformForSong(changed)).toBeNull();
  expect(await getCachedWaveform(legacy)).toEqual(legacy);
});

test('rejects a legacy primary-key collision with a different full fingerprint', async () => {
  await setCachedWaveform({ ...legacy, sourceFingerprint: `wf6:${'0'.repeat(32)}` });
  expect(await getCachedWaveformForSong(song)).toBeNull();
});

test('never promotes a synthetic legacy fallback into a decoded shape', async () => {
  await setCachedWaveform({ ...legacy, source: 'fallback' });
  expect(await getCachedWaveformForSong(song)).toBeNull();
});

test('keeps the old durable shape and new memory shape if the migration index write fails', async () => {
  await setCachedWaveform(legacy);
  const original = (AsyncStorage.setItem as jest.Mock).getMockImplementation()!;
  const spy = jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async (storageKey, value) => {
    if (storageKey === indexKey) throw new Error('disk full');
    return original(storageKey, value);
  });
  const migrated = await getCachedWaveformForSong(song);
  const identity = getWaveformSourceIdentity(song);
  await waitFor(() => expect(spy).toHaveBeenCalledWith(indexKey, expect.any(String)));
  await waitFor(async () => expect(await AsyncStorage.getItem(key(identity.sourceKey))).toBeNull());
  expect(await getCachedWaveform(legacy)).toEqual(legacy);
  expect(peekCachedWaveform(identity)).toEqual(migrated);
  spy.mockImplementation(original);
  resetWaveformCacheStateForTests();
  expect(await getCachedWaveformForSong(song)).toEqual(migrated);
  await waitFor(() => expect([...waveformFiles.values()].some(raw => JSON.parse(raw).sourceKey === legacy.sourceKey)).toBe(false));
});

test('retains completion history while reporting a missing waveform accurately', async () => {
  await markSongPrepared(legacy.sourceFingerprint);
  resetSongPreparationForTests();
  await loadPreparedSources();
  expect(getSongPreparationStatus(song)).toBe('pending');
  expect(getSongAnalysisState(song)).toEqual({ analysisCompleted: true, waveformAvailable: false, bassAvailable: false });
  const hook = renderHook(() => useSongPreparation(song));
  await act(async () => { await loadPreparedSources(); });
  expect(hook.result.current).toBe('pending');
  const identity = getWaveformSourceIdentity(song);
  await waitFor(() => expect(wasSongPrepared(identity.sourceFingerprint)).toBe(true));
  await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem('@musikplayer:prepared-sources:v1'))!))
    .toContain(identity.sourceFingerprint));
  hook.unmount();
  resetSongPreparationForTests();
  await loadPreparedSources();
  expect(getSongPreparationStatus({ ...song, duration: 124000 })).toBe('pending');
});
