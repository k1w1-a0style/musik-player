import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import type { Song } from '../../types/Song';
import { StorageKeys, storage } from '../../utils/storage';
import { resetNativeQueueMutationLockForTests, runExclusiveNativeQueueReplacement } from '../../utils/nativeQueueMutationLock';
import { applyHydrationFailureFallback } from '../musicHydrationFallback';
import { verifySupersededHydration } from '../musicHydrationHelpers';

const song: Song = { id: 's1', title: 'One', artist: 'A', uri: 'file:///1.mp3' };
const ref = (current: Song[] = []) => ({ current });
const createArgs = () => ({
  songsRef: ref([song]), queueContextRef: ref([song]), baseQueueContextRef: ref([song]), nativeQueueRef: ref([song]),
  setSongsState: jest.fn(), setCurrentSong: jest.fn(), setPlaybackQueue: jest.fn(), setShuffle: jest.fn(),
});
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };

beforeEach(async () => {
  (TrackPlayer as unknown as { __reset: () => void }).__reset();
  resetNativeQueueMutationLockForTests();
  await AsyncStorage.clear();
  await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');
  jest.clearAllMocks();
});

test('fallback waits for reorder replacement between reset and add', async () => {
  const args = createArgs(); const started = deferred(); const release = deferred();
  const reorder = runExclusiveNativeQueueReplacement(async () => {
    await TrackPlayer.reset(); started.resolve(); await release.promise;
    await TrackPlayer.add([{ ...song, url: song.uri! }]);
  });
  await started.promise;
  const fallback = applyHydrationFailureFallback(args, new Error('hydrate'));
  expect(TrackPlayer.reset).toHaveBeenCalledTimes(1);
  release.resolve();
  await Promise.all([reorder, fallback]);
  expect(await TrackPlayer.getQueue()).toEqual([]);
  expect(args.nativeQueueRef.current).toEqual([]);
  expect(args.queueContextRef.current).toEqual([]);
  expect(args.baseQueueContextRef.current).toEqual([]);
  expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
});

test('fallback waits for shuffle replacement through add and readback', async () => {
  const args = createArgs(); const addStarted = deferred(); const releaseAdd = deferred();
  const shuffle = runExclusiveNativeQueueReplacement(async () => {
    await TrackPlayer.reset();
    await TrackPlayer.add([{ ...song, url: song.uri! }]);
    addStarted.resolve(); await releaseAdd.promise;
    await TrackPlayer.getQueue();
  });
  await addStarted.promise;
  const fallback = applyHydrationFailureFallback(args, new Error('hydrate'));
  expect(args.setPlaybackQueue).not.toHaveBeenCalled();
  releaseAdd.resolve();
  await Promise.all([shuffle, fallback]);
  expect(args.setPlaybackQueue).toHaveBeenCalledWith([]);
  expect(args.setCurrentSong).toHaveBeenCalledWith(null);
  expect(args.setShuffle).toHaveBeenCalledWith(false);
});

test('play replacement requested after fallback cannot observe reset before state commit', async () => {
  const args = createArgs(); const resetStarted = deferred(); const releaseReset = deferred();
  const resetImpl = (TrackPlayer.reset as jest.Mock).getMockImplementation()!;
  (TrackPlayer.reset as jest.Mock).mockImplementationOnce(async () => {
    await resetImpl(); resetStarted.resolve(); await releaseReset.promise;
  });
  const fallback = applyHydrationFailureFallback(args, new Error('hydrate'));
  await resetStarted.promise;
  let observedCommittedState = false;
  const play = runExclusiveNativeQueueReplacement(async () => {
    observedCommittedState = args.queueContextRef.current.length === 0
      && args.nativeQueueRef.current.length === 0;
  });
  expect(observedCommittedState).toBe(false);
  releaseReset.resolve();
  await Promise.all([fallback, play]);
  expect(observedCommittedState).toBe(true);
});

test.each(['play', 'reorder', 'shuffle'])('superseded hydration verifies after newer %s action without resetting it', async () => {
  const args = createArgs();
  const blockerStarted = deferred();
  const releaseBlocker = deferred();
  const newerStarted = deferred();
  const blocker = runExclusiveNativeQueueReplacement(async () => {
    blockerStarted.resolve();
    await releaseBlocker.promise;
  });
  await blockerStarted.promise;
  const newer = runExclusiveNativeQueueReplacement(async () => {
    await TrackPlayer.reset();
    await TrackPlayer.add([{ ...song, url: song.uri! }]);
    args.nativeQueueRef.current = [song];
    args.queueContextRef.current = [song];
    args.baseQueueContextRef.current = [song];
    newerStarted.resolve();
  });
  const staleResult = {
    nativeStatus: 'superseded' as const,
    verifiedState: null,
    lastKnownUnverifiedState: { nativeQueueRef: [], logicalQueue: [], baseQueue: [] },
    currentSongPersistence: { status: 'not-required' as const },
    failureStage: 'snapshot' as const,
  };
  const verification = verifySupersededHydration(staleResult, args);
  expect(TrackPlayer.reset).not.toHaveBeenCalled();
  releaseBlocker.resolve();
  await newerStarted.promise;
  const result = await verification;
  await Promise.all([blocker, newer]);
  expect(result).toMatchObject({ nativeStatus: 'reconciled', verifiedState: 'confirmed', queue: [song], activeSong: song });
  expect(TrackPlayer.reset).toHaveBeenCalledTimes(1);
  expect(args.nativeQueueRef.current).toEqual([song]);
  expect(args.queueContextRef.current).toEqual([song]);
  expect(args.setCurrentSong).toHaveBeenCalledWith(song);
  expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBe('s1');
});
