import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWaveformSourceIdentity } from '../waveformGenerator';
import { loadPreparedSources, markSongPrepared, resetSongPreparationForTests,
  wasSongPrepared } from '../songPreparationStore';

const fingerprint = (id: string) => getWaveformSourceIdentity({ id, title: id, artist: 'Artist', uri: `file:///${id}.mp3` }).sourceFingerprint;
beforeEach(async () => { resetSongPreparationForTests(); await AsyncStorage.clear(); jest.clearAllMocks(); });

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(release => { resolve = release; });
  return { promise, resolve };
};

test('merges persisted completion with newly completed tracks without losing either', async () => {
  await markSongPrepared(fingerprint('old'));
  resetSongPreparationForTests();
  await Promise.all([markSongPrepared(fingerprint('new')), loadPreparedSources()]);
  resetSongPreparationForTests();
  await loadPreparedSources();
  expect(wasSongPrepared(fingerprint('old'))).toBe(true);
  expect(wasSongPrepared(fingerprint('new'))).toBe(true);
  expect(wasSongPrepared(fingerprint('replacement'))).toBe(false);
});

test('a completion write can recover after storage failure', async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('storage busy'));
  await expect(markSongPrepared(fingerprint('one'))).rejects.toThrow('storage busy');
  await markSongPrepared(fingerprint('one'));
  resetSongPreparationForTests();
  await loadPreparedSources();
  expect(wasSongPrepared(fingerprint('one'))).toBe(true);
});

test('does not rewrite completion when a ready row is remounted repeatedly', async () => {
  await markSongPrepared(fingerprint('one'));
  const count = (AsyncStorage.setItem as jest.Mock).mock.calls.length;
  await Promise.all(Array.from({ length: 20 }, () => markSongPrepared(fingerprint('one'))));
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(count);
});

test('does not serialize an unchanged history for repeated ready rows', async () => {
  await markSongPrepared(fingerprint('one'));
  const stringify = jest.spyOn(JSON, 'stringify');
  await Promise.all(Array.from({ length: 100 }, () => markSongPrepared(fingerprint('one'))));
  const calls = stringify.mock.calls.length;
  stringify.mockRestore();
  expect(calls).toBe(0);
});

test('coalesces concurrently completed rows into one durable snapshot', async () => {
  const ids = Array.from({ length: 100 }, (_, index) => fingerprint(`song-${index}`));
  await Promise.all(ids.map(markSongPrepared));
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  resetSongPreparationForTests();
  await loadPreparedSources();
  expect(ids.every(wasSongPrepared)).toBe(true);
});

test('persists a completion arriving during an in-flight write before resolving the shared flush', async () => {
  const release = deferred();
  const started = deferred();
  const setItem = AsyncStorage.setItem.bind(AsyncStorage);
  jest.spyOn(AsyncStorage, 'setItem').mockImplementationOnce(async (key, value) => {
    started.resolve();
    await release.promise;
    await setItem(key, value);
  });
  const first = markSongPrepared(fingerprint('first'));
  await started.promise;
  const second = markSongPrepared(fingerprint('second'));
  expect(second).toBe(first);
  release.resolve();
  await Promise.all([first, second]);
  resetSongPreparationForTests();
  await loadPreparedSources();
  expect(wasSongPrepared(fingerprint('first'))).toBe(true);
  expect(wasSongPrepared(fingerprint('second'))).toBe(true);
});

test('ignores stale hydration when the in-memory generation changes', async () => {
  const release = deferred();
  const started = deferred();
  jest.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(async () => {
    started.resolve();
    await release.promise;
    return JSON.stringify([fingerprint('stale')]);
  });
  const oldHydration = loadPreparedSources();
  await started.promise;
  resetSongPreparationForTests();
  await markSongPrepared(fingerprint('current'));
  release.resolve();
  await oldHydration;
  expect(wasSongPrepared(fingerprint('stale'))).toBe(false);
  expect(wasSongPrepared(fingerprint('current'))).toBe(true);
});

test('keeps a new generation write ordered behind an uncancellable old write', async () => {
  const release = deferred();
  const started = deferred();
  const setItem = AsyncStorage.setItem.bind(AsyncStorage);
  jest.spyOn(AsyncStorage, 'setItem').mockImplementationOnce(async (key, value) => {
    started.resolve();
    await release.promise;
    await setItem(key, value);
  });
  const oldWrite = markSongPrepared(fingerprint('old'));
  await started.promise;
  resetSongPreparationForTests();
  const currentWrite = markSongPrepared(fingerprint('current'));
  release.resolve();
  await Promise.all([oldWrite, currentWrite]);
  resetSongPreparationForTests();
  await loadPreparedSources();
  expect(wasSongPrepared(fingerprint('old'))).toBe(true);
  expect(wasSongPrepared(fingerprint('current'))).toBe(true);
});

test('retries a failed hydration without dropping local completions', async () => {
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read busy'));
  await expect(markSongPrepared(fingerprint('one'))).rejects.toThrow('read busy');
  await markSongPrepared(fingerprint('one'));
  resetSongPreparationForTests();
  await loadPreparedSources();
  expect(wasSongPrepared(fingerprint('one'))).toBe(true);
});
