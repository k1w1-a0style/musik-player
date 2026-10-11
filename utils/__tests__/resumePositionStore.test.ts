import AsyncStorage from '@react-native-async-storage/async-storage';
import { ResumePositionStore, RESUME_WRITE_INTERVAL_MS } from '../resumePositionStore';
import { parseResumePositions, RESUME_POSITIONS_KEY } from '../resumePosition';
import { blockPersistenceForMaintenance, releasePersistenceMaintenance } from '../persistenceMaintenance';
import type { Song } from '../../types/Song';
const rawKey = `@musikplayer:${RESUME_POSITIONS_KEY}`;
const song: Song = { id: 'mix', title: 'Mix', artist: 'Artist', uri: 'file:///Mix.mp3', duration: 3600000,
  fileInfo: { size: 1000, modificationTime: 1700000000000 } };
const setMock = AsyncStorage.setItem as jest.Mock;
const getMock = AsyncStorage.getItem as jest.Mock;
const setImpl = setMock.getMockImplementation()!;
const getImpl = getMock.getMockImplementation()!;
beforeEach(async () => {
  jest.useFakeTimers(); jest.setSystemTime(1800000000000); releasePersistenceMaintenance();
  setMock.mockImplementation(setImpl); getMock.mockImplementation(getImpl);
  await AsyncStorage.clear(); jest.clearAllMocks();
});
afterEach(() => { setMock.mockImplementation(setImpl); getMock.mockImplementation(getImpl); releasePersistenceMaintenance(); jest.useRealTimers(); jest.restoreAllMocks(); });
test('default Off performs no positions read, write or timer work', async () => {
  const store = new ResumePositionStore();
  await store.record(song, 120000, 3600000); await store.lookup(song); await store.flush();
  await jest.advanceTimersByTimeAsync(60000);
  expect(getMock).not.toHaveBeenCalled(); expect(setMock).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});
test('heartbeats coalesce into one throttled confirmed snapshot, and survive a new store', async () => {
  const store = new ResumePositionStore(); store.setEnabled(true);
  for (let i = 0; i < 7; i++) { await store.record(song, 120000 + i * 2000, 3600000); await jest.advanceTimersByTimeAsync(2000); }
  expect(setMock).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1000);
  expect(setMock).toHaveBeenCalledTimes(1);
  const restarted = new ResumePositionStore(); restarted.setEnabled(true);
  expect((await restarted.lookup(song))?.positionMs).toBe(132000);
  store.setEnabled(false); restarted.setEnabled(false);
});
test('Off ends new tracking immediately, retains saved data and drops its delayed timer', async () => {
  const store = new ResumePositionStore(); store.setEnabled(true);
  await store.record(song, 120000, 3600000); await store.flush();
  const before = await AsyncStorage.getItem(rawKey); jest.clearAllMocks();
  store.setEnabled(false); await store.record(song, 200000, 3600000);
  await jest.advanceTimersByTimeAsync(60000);
  expect(setMock).not.toHaveBeenCalled(); expect(getMock).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(rawKey)).toBe(before);
});
test('starting over or nearing the end removes the former resume position', async () => {
  const store = new ResumePositionStore(); store.setEnabled(true);
  await store.record(song, 120000, 3600000); await store.flush();
  await store.record(song, 0, 3600000); await store.flush();
  expect(await store.lookup(song)).toBeUndefined();
  await store.record(song, 240000, 3600000); await store.flush();
  await store.record(song, 3590000, 3600000); await store.flush();
  expect(parseResumePositions(await AsyncStorage.getItem(rawKey))).toEqual([]);
  store.setEnabled(false);
});
test('clear waits for the real writer and wins over its old snapshot without overlap', async () => {
  const store = new ResumePositionStore(); store.setEnabled(true);
  await store.record(song, 120000, 3600000);
  let finish!: () => void; const delayed = new Promise<void>(resolve => { finish = resolve; });
  let started = false; let active = 0; let maximum = 0;
  setMock.mockImplementation(async (key, value) => {
    active++; maximum = Math.max(maximum, active);
    if (!started) { started = true; await delayed; }
    await setImpl(key, value); active--;
  });
  const first = store.flush();
  expect(started).toBe(true);
  const clear = store.clear();
  expect(setMock).toHaveBeenCalledTimes(1);
  finish(); await first; await clear;
  expect(maximum).toBe(1);
  expect(parseResumePositions(await AsyncStorage.getItem(rawKey))).toEqual([]);
  store.setEnabled(false);
});
test('failed read cannot overwrite previous data; a failed write remains retryable', async () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const store = new ResumePositionStore(); store.setEnabled(true);
  getMock.mockRejectedValueOnce(new Error('read unavailable'));
  expect(await store.lookup(song)).toBeUndefined(); expect(setMock).not.toHaveBeenCalled();
  await store.record(song, 120000, 3600000);
  setMock.mockRejectedValueOnce(new Error('disk full'));
  await expect(store.flush()).rejects.toThrow();
  await store.flush();
  expect((await store.lookup(song))?.positionMs).toBe(120000);
  expect(warning).toHaveBeenCalled(); store.setEnabled(false);
});
test('a replaced provider epoch cannot publish any late resume data', async () => {
  const store = new ResumePositionStore(); store.setEnabled(true);
  await store.record(song, 120000, 3600000);
  blockPersistenceForMaintenance(); releasePersistenceMaintenance();
  await expect(store.flush()).rejects.toThrow('abgelösten');
  expect(setMock).not.toHaveBeenCalled(); store.setEnabled(false);
});
test('clear also cancels an old record whose positions read has not finished', async () => {
  const store = new ResumePositionStore(); store.setEnabled(true);
  let finish!: (raw: string | null) => void;
  getMock.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const oldRecord = store.record(song, 120000, 3600000);
  await store.clear(); finish(null); await oldRecord;
  expect(await store.lookup(song)).toBeUndefined();
  expect(parseResumePositions(await AsyncStorage.getItem(rawKey))).toEqual([]);
  store.setEnabled(false);
});
test('a late heartbeat cannot resurrect a position after starting over or explicitly clearing', async () => {
  const store = new ResumePositionStore(); store.setEnabled(true);
  await store.record(song, 120000, 3600000, Date.now() - 2000);
  await store.record(song, 0, 3600000, Date.now());
  await store.record(song, 118000, 3600000, Date.now() - 1000);
  expect(await store.lookup(song)).toBeUndefined();
  await store.clear();
  await store.record(song, 118000, 3600000, Date.now() - 1000);
  expect(await store.lookup(song)).toBeUndefined();
  await store.record(song, 122000, 3600000, Date.now() + 2000);
  expect((await store.lookup(song))?.positionMs).toBe(122000);
  store.setEnabled(false);
});
