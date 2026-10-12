import TrackPlayer from 'react-native-track-player';
import { asPlayableSong } from '../playableSong';
import { toTrackPlayerTrack } from '../trackPlayerTrack';
import { clearSafWriteOperationsForTests, resetSafWriteStartupForTests, runSafWriteOperation, getActiveSafWrite } from '../tagWriterLocks';
import { resetNativeQueueMutationLockForTests } from '../nativeQueueMutationLock';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { rebuildNativePlaybackQueueUnlocked } from '../../contexts/playbackQueueActionHelpers';

const uri = 'content://provider/document/primary:Music/one.mp3';
const playable = (target = uri) => asPlayableSong({ id: target, title: 'Title', artist: 'Artist', uri: target })!;
const deferred = () => { let release!: () => void; return { promise: new Promise<void>(resolve => { release = resolve; }), release: () => release() }; };
beforeEach(() => {
  jest.clearAllMocks();
  clearSafWriteOperationsForTests(); resetSafWriteStartupForTests();
  resetNativeQueueMutationLockForTests();
  (AsyncStorage as unknown as { __reset: () => void }).__reset();
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('real SAF ownership blocks all aliases entering native playback but permits unrelated sources', async () => {
  const gate = deferred();
  const operation = runSafWriteOperation(uri, () => gate.promise);
  for (let tick = 0; tick < 30 && !getActiveSafWrite(uri); tick += 1) await Promise.resolve();
  expect(getActiveSafWrite(uri)).toBeDefined();
  expect(() => toTrackPlayerTrack(playable())).toThrow('Tags');
  expect(() => toTrackPlayerTrack(playable('content://PROVIDER/tree/primary%3AMusic/document/primary%3AMusic%2Fone.mp3'))).toThrow('Tags');
  expect(toTrackPlayerTrack(playable('content://provider/document/primary:Music/two.mp3')).url).toContain('two.mp3');
  gate.release(); await operation;
  expect(toTrackPlayerTrack(playable()).url).toBe(uri);
});

test('a timeout retains the source guard until the actual native transaction settles', async () => {
  jest.useFakeTimers(); const gate = deferred();
  const operation = runSafWriteOperation(uri, () => gate.promise, { timeoutMs: 10 });
  for (let tick = 0; tick < 30 && getActiveSafWrite(uri)?.phase !== 'nativeMutationStarted'; tick += 1) await Promise.resolve();
  jest.advanceTimersByTime(10);
  expect((await operation).kind).toBe('pending');
  expect(() => toTrackPlayerTrack(playable())).toThrow('Tags');
  gate.release();
  for (let tick = 0; tick < 30 && getActiveSafWrite(uri); tick += 1) await Promise.resolve();
  expect(toTrackPlayerTrack(playable()).url).toBe(uri);
});

 test('a busy target cannot reset the existing native queue before rejection', async () => {
  const gate = deferred();
  const operation = runSafWriteOperation(uri, () => gate.promise);
  for (let tick = 0; tick < 30 && !getActiveSafWrite(uri); tick += 1) await Promise.resolve();
  const reset = jest.spyOn(TrackPlayer, 'reset');
  const beginNativeMutation = jest.fn();
  await expect(rebuildNativePlaybackQueueUnlocked([playable()], { current: [] }, undefined,
    { isCurrent: () => true, beginNativeMutation })).rejects.toThrow('Tags');
  expect(reset).not.toHaveBeenCalled(); expect(beginNativeMutation).not.toHaveBeenCalled();
  gate.release(); await operation;
});
