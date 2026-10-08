// eslint-disable-next-line @typescript-eslint/no-require-imports -- Isolated native filesystem boundary.
jest.mock('expo-file-system/legacy', () => require('./waveformFileSystemMock'));
import AsyncStorage from '@react-native-async-storage/async-storage';
import SystemAudio from 'expo-system-audio';
import { makeDirectoryAsync, writeAsStringAsync, resetWaveformFileSystem } from './waveformFileSystemMock';
import { getCachedWaveform, resetWaveformCacheStateForTests } from '../waveformCache';
import { getWaveformSourceIdentity } from '../waveformGenerator';
import { getWaveformStatus } from '../waveformStatus';
import { resetWaveformExtractionLifecycleForTests } from '../waveformExtractionLifecycle';
import { resetSongPreparationForTests } from '../songPreparationStore';
import { isMetadataRefreshActive, resetMetadataRefreshActivityForTests } from '../metadataRefreshActivity';
import { cancelWaveformPreparation, getWaveformPreparationState, prepareLibraryWaveforms,
  resetWaveformPreparationForTests } from '../libraryWaveformPreparation';

const song = { id: 'storage', title: 'Storage', artist: 'Artist', uri: 'file:///storage.mp3', duration: 60_000 };
const decoded = { points: [0.1, 0.8, 0.2, 0.7, 0.3, 0.9, 0.4, 0.6], analysis: 'decoded-pcm-v1' as const };
const native = SystemAudio as typeof SystemAudio & { extractWaveformPeaks: jest.Mock };

beforeEach(async () => {
  jest.useFakeTimers();
  resetWaveformFileSystem(); resetWaveformCacheStateForTests(); resetSongPreparationForTests();
  resetWaveformPreparationForTests(); resetWaveformExtractionLifecycleForTests(); resetMetadataRefreshActivityForTests();
  await AsyncStorage.clear();
  native.extractWaveformPeaks = jest.fn().mockResolvedValue(decoded);
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('publishes preparation immediately and cancels a blocked cache lookup without waiting for native IO', async () => {
  let release!: () => void;
  makeDirectoryAsync.mockImplementationOnce(() => new Promise<undefined>(resolve => { release = () => resolve(undefined); }));
  const task = prepareLibraryWaveforms([song]);
  let settled = false;
  void task.then(() => { settled = true; });
  await jest.advanceTimersByTimeAsync(0);
  const initial = getWaveformPreparationState().status;
  cancelWaveformPreparation();
  await jest.advanceTimersByTimeAsync(0);
  const cancelled = { settled, state: getWaveformPreparationState().status, busy: isMetadataRefreshActive() };
  // Release the actual IO for test cleanup, independently of the UI's cancel.
  release(); await jest.advanceTimersByTimeAsync(1000); await task;
  expect(initial).toBe('running');
  expect(cancelled).toEqual({ settled: true, state: 'cancelled', busy: false });
  expect(native.extractWaveformPeaks).not.toHaveBeenCalled();
});

test('stops a blocked cache operation with a visible retryable failure instead of an endless preparation', async () => {
  let release!: () => void;
  makeDirectoryAsync.mockImplementationOnce(() => new Promise<undefined>(resolve => { release = () => resolve(undefined); }));
  const task = prepareLibraryWaveforms([song]);
  let settled = false;
  void task.then(() => { settled = true; });
  await jest.advanceTimersByTimeAsync(10_001);
  const timedOut = { settled, state: getWaveformPreparationState().status, busy: isMetadataRefreshActive() };
  release(); await jest.advanceTimersByTimeAsync(1000); await task;
  expect(timedOut).toEqual({ settled: true, state: 'failed', busy: false });
  expect(native.extractWaveformPeaks).not.toHaveBeenCalled();
});

test('historical completion hydration cannot block actual cache validation and decoding', async () => {
  const mockedGetItem = jest.mocked(AsyncStorage.getItem);
  const getItem = mockedGetItem.getMockImplementation()!;
  let release!: (value: null) => void;
  jest.spyOn(AsyncStorage, 'getItem').mockImplementation(key => key === '@musikplayer:prepared-sources:v1'
    ? new Promise<null>(resolve => { release = resolve; }) : getItem(key));
  const task = prepareLibraryWaveforms([song]);
  let settled = false;
  void task.then(() => { settled = true; });
  await jest.advanceTimersByTimeAsync(1000);
  const beforeHistory = { settled, state: getWaveformPreparationState().status, calls: native.extractWaveformPeaks.mock.calls.length };
  release(null); await jest.advanceTimersByTimeAsync(1000); await task;
  mockedGetItem.mockImplementation(getItem);
  expect(beforeHistory).toEqual({ settled: true, state: 'completed', calls: 1 });
});

test('a failed persistent waveform write stops the batch while keeping decoded data playable in memory', async () => {
  writeAsStringAsync.mockRejectedValueOnce(new Error('Disk full'));
  const task = prepareLibraryWaveforms([song, { ...song, id: 'next', uri: 'file:///next.mp3' }]);
  await jest.advanceTimersByTimeAsync(1000); await task;
  expect(getWaveformPreparationState()).toMatchObject({ status: 'failed', processed: 0 });
  expect(native.extractWaveformPeaks).toHaveBeenCalledTimes(1);
  const identity = getWaveformSourceIdentity(song);
  expect(getWaveformStatus(identity.sourceFingerprint)).toBe('ready');
  await expect(getCachedWaveform(identity)).resolves.toMatchObject({ source: 'native' });
  expect(isMetadataRefreshActive()).toBe(false);
});
