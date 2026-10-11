import AsyncStorage from '@react-native-async-storage/async-storage';
import { WAVEFORM_FINGERPRINT_PREFIX } from '../waveformTypes';
import { flushPreparedSources, loadPreparedSources, markSongPrepared, queueSongPrepared,
  resetSongPreparationForTests, retainPreparedSources, subscribeSongPreparation, wasSongPrepared } from '../songPreparationStore';
import { getWaveformProgress, getWaveformStatus, resetWaveformStatusForTests, retainWaveformStatuses,
  setWaveformProgress, setWaveformStatus, subscribeWaveformStatus } from '../waveformStatus';

const fingerprint = (index: number): string => `${WAVEFORM_FINGERPRINT_PREFIX}${index.toString(16).padStart(32, '0')}`;
beforeEach(async () => {
  resetSongPreparationForTests(); resetWaveformStatusForTests(); await AsyncStorage.clear(); jest.clearAllMocks();
});
afterEach(() => { resetSongPreparationForTests(); resetWaveformStatusForTests(); jest.restoreAllMocks(); jest.useRealTimers(); });

test('bounds optional history at 10000 recent entries without dropping newly completed sources', async () => {
  await Promise.all(Array.from({ length: 10005 }, (_, index) => markSongPrepared(fingerprint(index))));
  expect(wasSongPrepared(fingerprint(0))).toBe(false);
  expect(wasSongPrepared(fingerprint(10004))).toBe(true);
  const stored = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)![1] as string;
  expect(JSON.parse(stored)).toHaveLength(10000);
});

test('bounds inactive status entries while retaining a subscribed row and active analysis', () => {
  const stop = subscribeWaveformStatus('visible', jest.fn());
  setWaveformStatus('visible', 'ready'); setWaveformStatus('active', 'analyzing'); setWaveformProgress('active', 0.6);
  for (let index = 0; index < 10005; index += 1) setWaveformStatus(`old-${index}`, 'ready');
  expect(getWaveformStatus('old-0')).toBe('pending');
  expect(getWaveformStatus('old-10004')).toBe('ready');
  expect(getWaveformStatus('visible')).toBe('ready');
  expect(getWaveformProgress('active')).toBe(0.6);
  stop();
});

test('prunes outdated revisions after subscribed and analyzing ownership ends', async () => {
  await Promise.all([markSongPrepared(fingerprint(1)), markSongPrepared(fingerprint(2)), markSongPrepared(fingerprint(3))]);
  const stopHistory = subscribeSongPreparation(fingerprint(2), jest.fn());
  const stopStatus = subscribeWaveformStatus(fingerprint(2), jest.fn());
  setWaveformStatus(fingerprint(1), 'ready'); setWaveformStatus(fingerprint(2), 'ready');
  setWaveformStatus(fingerprint(3), 'analyzing'); setWaveformProgress(fingerprint(3), 0.4);
  const current = new Set([fingerprint(1)]);
  retainPreparedSources(current); retainWaveformStatuses(current);
  expect(wasSongPrepared(fingerprint(2))).toBe(true);
  expect(wasSongPrepared(fingerprint(3))).toBe(false);
  expect(getWaveformProgress(fingerprint(3))).toBe(0.4);
  stopHistory(); stopStatus(); setWaveformStatus(fingerprint(3), 'ready');
  await flushPreparedSources();
  expect(wasSongPrepared(fingerprint(2))).toBe(false);
  expect(getWaveformStatus(fingerprint(2))).toBe('pending');
  expect(getWaveformProgress(fingerprint(2))).toBeNull();
  expect(getWaveformStatus(fingerprint(3))).toBe('pending');
  resetSongPreparationForTests(); await loadPreparedSources();
  expect(wasSongPrepared(fingerprint(1))).toBe(true);
  expect(wasSongPrepared(fingerprint(2))).toBe(false);
});

test('does not reintroduce obsolete persisted revisions during late hydration', async () => {
  await AsyncStorage.setItem('@musikplayer:prepared-sources:v1', JSON.stringify([fingerprint(1), fingerprint(2)]));
  retainPreparedSources(new Set([fingerprint(2)]));
  await loadPreparedSources();
  expect(wasSongPrepared(fingerprint(1))).toBe(false);
  expect(wasSongPrepared(fingerprint(2))).toBe(true);
  await flushPreparedSources();
  expect(JSON.parse((await AsyncStorage.getItem('@musikplayer:prepared-sources:v1'))!)).toEqual([fingerprint(2)]);
});

test('checks the history string budget before JSON parse', async () => {
  await AsyncStorage.setItem('@musikplayer:prepared-sources:v1', ' '.repeat(1024 * 1024 + 1));
  const parse = jest.spyOn(JSON, 'parse');
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  await loadPreparedSources();
  expect(parse).not.toHaveBeenCalled(); expect(warn).toHaveBeenCalledTimes(1);
});

test('flushes a small optional batch after one second or an explicit durable barrier', async () => {
  jest.useFakeTimers();
  queueSongPrepared(fingerprint(1));
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(999);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  queueSongPrepared(fingerprint(2)); await flushPreparedSources();
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(2000);
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
});

test('a failed queued flush preserves dirty completion for a later durable retry', async () => {
  queueSongPrepared(fingerprint(1));
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('storage busy'));
  await expect(flushPreparedSources()).rejects.toThrow('storage busy');
  await markSongPrepared(fingerprint(1));
  resetSongPreparationForTests(); await loadPreparedSources();
  expect(wasSongPrepared(fingerprint(1))).toBe(true);
});
