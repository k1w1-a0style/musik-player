import TrackPlayer, { State } from 'react-native-track-player';
import type { Song } from '../../types/Song';
import { resetNativeQueueMutationLockForTests } from '../../utils/nativeQueueMutationLock';
import { createHydrationPlan } from '../musicHydrationPlan';
import { storage } from '../../utils/storage';
import { applyHydratedNativeQueue, type HydratedNativeQueueResult } from '../musicHydrationNativeQueue';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///1.mp3' },
  { id: 's2', title: 'Two', artist: 'A', uri: 'file:///2.mp3' },
];
const stored = { songs, playlists: null, eqEnabled: null, eqBands: null, eqPreset: null, volume: null,
  repeatMode: null, shuffle: false, currentSongId: 's1' };
const ref = (current: Song[] = []) => ({ current });
const player = TrackPlayer as unknown as {
  __reset: () => void;
  __getQueue: () => Song[];
  __getActiveTrackIndex: () => number;
  __getState: () => State;
};
const restore = () => {
  (TrackPlayer.getQueue as jest.Mock).mockImplementation(async () => player.__getQueue());
  (TrackPlayer.getActiveTrack as jest.Mock).mockImplementation(async () => player.__getQueue()[player.__getActiveTrackIndex()]);
  (TrackPlayer.getActiveTrackIndex as jest.Mock).mockImplementation(async () =>
    player.__getActiveTrackIndex() >= 0 ? player.__getActiveTrackIndex() : undefined);
  (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 0 });
  (TrackPlayer.getPlaybackState as jest.Mock).mockImplementation(async () => ({ state: player.__getState() }));
};
const targets = () => ({
  nativeQueueRef: ref(),
  queueContextRef: ref(),
  baseQueueContextRef: ref(),
  setPlaybackQueue: jest.fn(),
  setCurrentSong: jest.fn(),
  setShuffle: jest.fn(),
  shuffleRef: { current: false },
});
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};
function expectVerified(result: HydratedNativeQueueResult): asserts result is Extract<HydratedNativeQueueResult, { verifiedState: 'confirmed' }> {
  expect(result.verifiedState).toBe('confirmed');
  if (result.verifiedState === null) throw new Error('Expected verified hydration state.');
}

beforeEach(() => {
  player.__reset();
  restore();
  jest.clearAllMocks();
  restore();
  resetNativeQueueMutationLockForTests();
});

test('successful hydration commits only full native readback', async () => {
  const state = targets();
  const plan = createHydrationPlan(stored, songs);
  const result = await applyHydratedNativeQueue({
    plan,
    nativeQueueRef: state.nativeQueueRef,
    targets: state,
    isCancelled: () => false,
  });
  expect(result).toMatchObject({ nativeStatus: 'applied', planStatus: 'fulfilled' });
  expect(state.queueContextRef.current).toEqual(songs);
  expect(state.setCurrentSong).toHaveBeenCalledWith(songs[0]);
});

test('clearMalformedCurrent removes an unknown native track without mapping a snapshot', async () => {
  const staleTrack = { id: 'removed-song', title: 'Removed', artist: 'A', url: 'file:///removed.mp3' };
  await TrackPlayer.add(staleTrack);
  const state = targets();
  const removeSpy = jest.spyOn(storage, 'remove');
  const plan = createHydrationPlan({ ...stored, currentSongId: staleTrack.id }, songs);

  expect(plan.nativeQueueAction).toBe('clearMalformedCurrent');
  const result = await applyHydratedNativeQueue({
    plan,
    nativeQueueRef: state.nativeQueueRef,
    targets: state,
    librarySongs: songs,
    isCancelled: () => false,
  });

  expect(result).toMatchObject({
    nativeStatus: 'applied',
    verifiedState: 'confirmed',
    planStatus: 'fulfilled',
    queue: [],
    activeSong: null,
  });
  expect(player.__getQueue()).toEqual([]);
  expect(state.nativeQueueRef.current).toEqual([]);
  expect(state.queueContextRef.current).toEqual([]);
  expect(state.setCurrentSong).toHaveBeenCalledWith(null);
  expect(removeSpy).toHaveBeenCalled();
  expect(plan.hydratedSongs).toEqual(songs);
  expect(plan.normalizedPlaylists).toBe(stored.playlists);
});

test('clearMalformedCurrent cancellation during reset performs no stale readback, setter or persistence', async () => {
  const state = targets();
  const resetStarted = deferred();
  const releaseReset = deferred();
  let cancelled = false;
  const reset = (TrackPlayer.reset as jest.Mock).getMockImplementation()!;
  const setSpy = jest.spyOn(storage, 'set');
  const removeSpy = jest.spyOn(storage, 'remove');
  (TrackPlayer.reset as jest.Mock).mockImplementationOnce(async (...args: unknown[]) => {
    resetStarted.resolve();
    await releaseReset.promise;
    return reset(...args);
  });
  const promise = applyHydratedNativeQueue({
    plan: createHydrationPlan({ ...stored, currentSongId: 'removed' }, songs),
    nativeQueueRef: state.nativeQueueRef,
    targets: state,
    isCancelled: () => cancelled,
  });
  await resetStarted.promise;
  cancelled = true;
  releaseReset.resolve();
  const result = await promise;
  expect(result).toMatchObject({ nativeStatus: 'cancelled', verifiedState: null });
  expect(TrackPlayer.getQueue).not.toHaveBeenCalled();
  expect(state.setPlaybackQueue).not.toHaveBeenCalled();
  expect(state.setCurrentSong).not.toHaveBeenCalled();
  expect(setSpy).not.toHaveBeenCalled();
  expect(removeSpy).not.toHaveBeenCalled();
});

test('clearMalformedCurrent cancellation after rejected reset prevents a second reset', async () => {
  const state = targets();
  let cancelled = false;
  (TrackPlayer.reset as jest.Mock).mockImplementationOnce(async () => {
    cancelled = true;
    throw new Error('reset acknowledgement failed');
  });
  const result = await applyHydratedNativeQueue({
    plan: createHydrationPlan({ ...stored, currentSongId: 'removed' }, songs),
    nativeQueueRef: state.nativeQueueRef,
    targets: state,
    isCancelled: () => cancelled,
  });
  expect(result).toMatchObject({ nativeStatus: 'cancelled', verifiedState: null });
  expect(TrackPlayer.reset).toHaveBeenCalledTimes(1);
  expect(TrackPlayer.getQueue).not.toHaveBeenCalled();
});

test('clearMalformedCurrent reconciles when the second reset is effective but rejects', async () => {
  await TrackPlayer.add({ id: 'removed', url: 'file:///removed.mp3' });
  const state = targets();
  const reset = (TrackPlayer.reset as jest.Mock).getMockImplementation()!;
  (TrackPlayer.reset as jest.Mock)
    .mockRejectedValueOnce(new Error('first reset rejected'))
    .mockImplementationOnce(async (...args: unknown[]) => {
      await reset(...args);
      throw new Error('second acknowledgement rejected');
    });
  const result = await applyHydratedNativeQueue({
    plan: createHydrationPlan({ ...stored, currentSongId: 'removed' }, songs),
    nativeQueueRef: state.nativeQueueRef,
    targets: state,
    isCancelled: () => false,
  });
  expect(result).toMatchObject({
    nativeStatus: 'reconciled',
    verifiedState: 'confirmed',
    planStatus: 'fulfilled',
    queue: [],
  });
  expect(player.__getQueue()).toEqual([]);
  expect(state.setCurrentSong).toHaveBeenCalledWith(null);
});

test('clearMalformedCurrent publishes stable non-empty truth as retry-required without persistence', async () => {
  await TrackPlayer.add(songs.map(song => ({ ...song, url: song.uri! })));
  const state = targets();
  const setSpy = jest.spyOn(storage, 'set');
  const removeSpy = jest.spyOn(storage, 'remove');
  (TrackPlayer.reset as jest.Mock)
    .mockRejectedValueOnce(new Error('first reset rejected'))
    .mockRejectedValueOnce(new Error('second reset rejected'));

  const result = await applyHydratedNativeQueue({
    plan: createHydrationPlan({ ...stored, currentSongId: 'removed' }, songs),
    nativeQueueRef: state.nativeQueueRef,
    targets: state,
    isCancelled: () => false,
  });

  expect(result).toMatchObject({
    nativeStatus: 'reconciled',
    verifiedState: 'confirmed',
    planStatus: 'retry-required',
    queue: songs,
    activeSong: songs[0],
  });
  expect(state.queueContextRef.current).toEqual(songs);
  expect(state.setCurrentSong).toHaveBeenCalledWith(songs[0]);
  expect(setSpy).not.toHaveBeenCalled();
  expect(removeSpy).not.toHaveBeenCalled();
});

test('clearMalformedCurrent cancellation after empty readback suppresses stale setters', async () => {
  const state = targets();
  const readStarted = deferred();
  const releaseRead = deferred();
  let cancelled = false;
  (TrackPlayer.getQueue as jest.Mock).mockImplementationOnce(async () => {
    readStarted.resolve();
    await releaseRead.promise;
    return [];
  });
  const promise = applyHydratedNativeQueue({
    plan: createHydrationPlan({ ...stored, currentSongId: 'removed' }, songs),
    nativeQueueRef: state.nativeQueueRef,
    targets: state,
    isCancelled: () => cancelled,
  });
  await readStarted.promise;
  cancelled = true;
  releaseRead.resolve();
  const result = await promise;
  expect(result).toMatchObject({ nativeStatus: 'cancelled', verifiedState: null });
  expect(state.setPlaybackQueue).not.toHaveBeenCalled();
  expect(state.setCurrentSong).not.toHaveBeenCalled();
});

test('full hydration reject after native side effect reconciles the full queue', async () => {
  const state = targets();
  const plan = createHydrationPlan(stored, songs);
  const add = (TrackPlayer.add as jest.Mock).getMockImplementation()!;
  (TrackPlayer.add as jest.Mock).mockImplementationOnce(async (...args: unknown[]) => {
    await add(...args);
    throw new Error('ack');
  });
  const result = await applyHydratedNativeQueue({
    plan,
    nativeQueueRef: state.nativeQueueRef,
    targets: state,
    isCancelled: () => false,
  });
  expect(result.nativeStatus).toBe('reconciled');
  expectVerified(result);
  expect(result.queue).toEqual(songs);
});

test('partial hydration reject publishes only known tracks actually present', async () => {
  const state = targets();
  const plan = createHydrationPlan(stored, songs);
  const add = (TrackPlayer.add as jest.Mock).getMockImplementation()!;
  (TrackPlayer.add as jest.Mock).mockImplementationOnce(async (tracks: Song[]) => {
    await add(tracks[0]);
    throw new Error('partial');
  });
  const result = await applyHydratedNativeQueue({
    plan,
    nativeQueueRef: state.nativeQueueRef,
    targets: state,
    isCancelled: () => false,
  });
  expect(result.nativeStatus).toBe('reconciled');
  expectVerified(result);
  expect(result.queue).toEqual([songs[0]]);
  expect(result.baseQueue).toEqual([songs[0]]);
  expect(result.planStatus).toBe('retry-required');
});

test('post-mutation recovery with exclusively unstable readbacks remains retryable', async () => {
  const state = targets();
  const forward = songs.map(song => ({ ...song, url: song.uri! }));
  const reverse = [forward[1], forward[0]];
  let queueRead = 0;
  (TrackPlayer.getQueue as jest.Mock).mockImplementation(async () => {
    queueRead += 1;
    if (queueRead <= 2) return [];
    return queueRead % 2 === 0 ? forward : reverse;
  });

  const result = await applyHydratedNativeQueue({
    plan: createHydrationPlan(stored, songs),
    nativeQueueRef: state.nativeQueueRef,
    targets: state,
    isCancelled: () => false,
  });

  expect(result).toMatchObject({ nativeStatus: 'readback-unstable', verifiedState: null, failureStage: 'readback' });
  expect(result.recoveryErrors).toMatchObject({
    originalError: { name: 'NativeQueueReadbackUnstableError' },
    initialReadbackError: { name: 'NativeQueueReadbackUnstableError' },
    rollbackVerificationError: { name: 'NativeQueueReadbackUnstableError' },
    finalReadbackError: { name: 'NativeQueueReadbackUnstableError' },
  });
  expect(state.nativeQueueRef.current).toEqual([]);
  expect(state.queueContextRef.current).toEqual([]);
  expect(state.setPlaybackQueue).not.toHaveBeenCalled();
});

test('unknown-track and rollback bridge failures remain fatal after mutation', async () => {
  const unknown = [{ id: 'unknown-native-track', url: 'file:///unknown.mp3' }];
  for (const rollbackFails of [false, true]) {
    player.__reset();
    restore();
    jest.clearAllMocks();
    restore();
    resetNativeQueueMutationLockForTests();
    const state = targets();
    let queueRead = 0;
    (TrackPlayer.getQueue as jest.Mock).mockImplementation(async () => (++queueRead <= 2 ? [] : unknown));
    if (rollbackFails) {
      const reset = (TrackPlayer.reset as jest.Mock).getMockImplementation()!;
      let resets = 0;
      (TrackPlayer.reset as jest.Mock).mockImplementation(async (...args: unknown[]) => {
        resets += 1;
        if (resets === 2) throw new Error('rollback bridge failed');
        return reset(...args);
      });
    }
    const result = await applyHydratedNativeQueue({
      plan: createHydrationPlan(stored, songs),
      nativeQueueRef: state.nativeQueueRef,
      targets: state,
      isCancelled: () => false,
    });
    expect(result).toMatchObject({ nativeStatus: 'failed', verifiedState: null });
    if (rollbackFails) expect(result.recoveryErrors?.rollbackExecutionError).toEqual(new Error('rollback bridge failed'));
  }
});

test.each([
  ['initialize', stored],
  ['none', { ...stored, currentSongId: null }],
] as const)('cancellation after snapshot prevents every %s side effect', async (_label, storedState) => {
  const state = targets();
  state.nativeQueueRef.current = songs.slice();
  state.queueContextRef.current = songs.slice();
  state.baseQueueContextRef.current = songs.slice();
  const snapshotStarted = deferred();
  const releaseSnapshot = deferred();
  let cancelled = false;
  const getQueue = (TrackPlayer.getQueue as jest.Mock).getMockImplementation()!;
  (TrackPlayer.getQueue as jest.Mock).mockImplementationOnce(async () => {
    snapshotStarted.resolve();
    await releaseSnapshot.promise;
    return getQueue();
  });
  const setSpy = jest.spyOn(storage, 'set');
  const removeSpy = jest.spyOn(storage, 'remove');
  const promise = applyHydratedNativeQueue({
    plan: createHydrationPlan(storedState, songs),
    nativeQueueRef: state.nativeQueueRef,
    targets: state,
    isCancelled: () => cancelled,
  });
  await snapshotStarted.promise;
  cancelled = true;
  releaseSnapshot.resolve();
  const result = await promise;
  expect(result).toMatchObject({ nativeStatus: 'cancelled', verifiedState: null });
  expect(TrackPlayer.reset).not.toHaveBeenCalled();
  expect(TrackPlayer.add).not.toHaveBeenCalled();
  expect(state.nativeQueueRef.current).toEqual(songs);
  expect(state.queueContextRef.current).toEqual(songs);
  expect(state.baseQueueContextRef.current).toEqual(songs);
  expect(state.setPlaybackQueue).not.toHaveBeenCalled();
  expect(state.setCurrentSong).not.toHaveBeenCalled();
  expect(state.setShuffle).not.toHaveBeenCalled();
  expect(setSpy).not.toHaveBeenCalled();
  expect(removeSpy).not.toHaveBeenCalled();
});

test('cancellation during an effective add does not publish stale state or persistence', async () => {
  const state = targets();
  const plan = createHydrationPlan(stored, songs);
  const started = deferred();
  const release = deferred();
  let cancelled = false;
  const add = (TrackPlayer.add as jest.Mock).getMockImplementation()!;
  const setSpy = jest.spyOn(storage, 'set');
  const removeSpy = jest.spyOn(storage, 'remove');
  (TrackPlayer.add as jest.Mock).mockImplementationOnce(async (...args: unknown[]) => {
    await add(...args);
    started.resolve();
    await release.promise;
  });
  const promise = applyHydratedNativeQueue({
    plan,
    nativeQueueRef: state.nativeQueueRef,
    targets: state,
    isCancelled: () => cancelled,
  });
  await started.promise;
  cancelled = true;
  release.resolve();
  const result = await promise;
  expect(result).toMatchObject({ nativeStatus: 'cancelled', verifiedState: null });
  expect(state.queueContextRef.current).toEqual([]);
  expect(state.setPlaybackQueue).not.toHaveBeenCalled();
  expect(state.setCurrentSong).not.toHaveBeenCalled();
  expect(setSpy).not.toHaveBeenCalled();
  expect(removeSpy).not.toHaveBeenCalled();
});

test('cancellation after successful reset does not clear logical state or persisted current song', async () => {
  const state = targets();
  state.nativeQueueRef.current = songs.slice();
  state.queueContextRef.current = songs.slice();
  state.baseQueueContextRef.current = songs.slice();
  const plan = createHydrationPlan(stored, songs);
  let cancelled = false;
  const reset = (TrackPlayer.reset as jest.Mock).getMockImplementation()!;
  const removeSpy = jest.spyOn(storage, 'remove');
  (TrackPlayer.reset as jest.Mock).mockImplementationOnce(async () => {
    await reset();
    cancelled = true;
  });
  const result = await applyHydratedNativeQueue({
    plan,
    nativeQueueRef: state.nativeQueueRef,
    targets: state,
    isCancelled: () => cancelled,
  });
  expect(result).toMatchObject({ nativeStatus: 'cancelled', verifiedState: null });
  expect(state.queueContextRef.current).toEqual(songs);
  expect(state.setPlaybackQueue).not.toHaveBeenCalled();
  expect(state.setCurrentSong).not.toHaveBeenCalled();
  expect(removeSpy).not.toHaveBeenCalled();
});

test('queue with no active track requires retry and preserves the planned current song id', async () => {
  const state = targets();
  const plan = createHydrationPlan(stored, songs);
  const setSpy = jest.spyOn(storage, 'set');
  const removeSpy = jest.spyOn(storage, 'remove');
  (TrackPlayer.add as jest.Mock).mockImplementationOnce(async () => undefined);
  (TrackPlayer.getQueue as jest.Mock).mockResolvedValue(songs);
  (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue(undefined);
  (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(undefined);
  const result = await applyHydratedNativeQueue({
    plan,
    nativeQueueRef: state.nativeQueueRef,
    targets: state,
    isCancelled: () => false,
  });
  expectVerified(result);
  expect(result).toMatchObject({ activeSong: null, planStatus: 'retry-required' });
  expect(state.setCurrentSong).toHaveBeenCalledWith(null);
  expect(setSpy).not.toHaveBeenCalled();
  expect(removeSpy).not.toHaveBeenCalled();
});

test('current-song-less no-op publishes native truth without inventing persisted current song', async () => {
  await TrackPlayer.add(songs.map(song => ({ ...song, url: song.uri! })));
  const state = targets();
  const setSpy = jest.spyOn(storage, 'set');
  const removeSpy = jest.spyOn(storage, 'remove');
  const plan = createHydrationPlan({ ...stored, currentSongId: null }, songs);

  const result = await applyHydratedNativeQueue({
    plan,
    nativeQueueRef: state.nativeQueueRef,
    targets: state,
    isCancelled: () => false,
  });

  expect(plan.nativeQueueAction).toBe('none');
  expect(result).toMatchObject({ nativeStatus: 'noop', verifiedState: 'confirmed', planStatus: 'fulfilled' });
  expect(state.setCurrentSong).toHaveBeenCalledWith(songs[0]);
  expect(setSpy).not.toHaveBeenCalled();
  expect(removeSpy).not.toHaveBeenCalled();
});

test('early cancellation with an existing queue never invents an empty verified state', async () => {
  await TrackPlayer.add(songs.map(song => ({ ...song, url: song.uri! })));
  const state = targets();
  state.nativeQueueRef.current = songs.slice();
  state.queueContextRef.current = songs.slice();
  state.baseQueueContextRef.current = songs.slice();
  const result = await applyHydratedNativeQueue({
    plan: createHydrationPlan(stored, songs),
    nativeQueueRef: state.nativeQueueRef,
    targets: state,
    isCancelled: () => true,
  });
  expect(result).toMatchObject({ nativeStatus: 'cancelled', verifiedState: null });
  expect(result).not.toHaveProperty('queue');
  expect(result.verifiedState === null && result.lastKnownUnverifiedState.nativeQueueRef).toEqual(songs);
});

test('snapshot failure is classified without publishing ref contents as verified queue', async () => {
  const state = targets();
  state.nativeQueueRef.current = songs.slice();
  (TrackPlayer.getQueue as jest.Mock).mockRejectedValueOnce(new Error('snapshot failed'));
  const result = await applyHydratedNativeQueue({
    plan: createHydrationPlan(stored, songs),
    nativeQueueRef: state.nativeQueueRef,
    targets: state,
    isCancelled: () => false,
  });
  expect(result).toMatchObject({ nativeStatus: 'failed', verifiedState: null, failureStage: 'snapshot' });
  expect(result).not.toHaveProperty('queue');
});
