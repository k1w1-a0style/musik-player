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
const player = TrackPlayer as unknown as { __reset: () => void; __getQueue: () => Song[]; __getActiveTrackIndex: () => number; __getState: () => State };
const restore = () => {
  (TrackPlayer.getQueue as jest.Mock).mockImplementation(async () => player.__getQueue());
  (TrackPlayer.getActiveTrack as jest.Mock).mockImplementation(async () => player.__getQueue()[player.__getActiveTrackIndex()]);
  (TrackPlayer.getActiveTrackIndex as jest.Mock).mockImplementation(async () => player.__getActiveTrackIndex() >= 0 ? player.__getActiveTrackIndex() : undefined);
  (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 0 });
  (TrackPlayer.getPlaybackState as jest.Mock).mockImplementation(async () => ({ state: player.__getState() }));
};
const targets = () => ({ nativeQueueRef: ref(), queueContextRef: ref(), baseQueueContextRef: ref(),
  setPlaybackQueue: jest.fn(), setCurrentSong: jest.fn(), setShuffle: jest.fn(), shuffleRef: { current: false } });
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };
function expectVerified(result: HydratedNativeQueueResult): asserts result is Extract<HydratedNativeQueueResult, { verifiedState: 'confirmed' }> {
  expect(result.verifiedState).toBe('confirmed');
  if (result.verifiedState === null) throw new Error('Expected verified hydration state.');
}

beforeEach(() => { player.__reset(); restore(); jest.clearAllMocks(); restore(); resetNativeQueueMutationLockForTests(); });

test('successful hydration commits only full native readback', async () => {
  const state = targets(); const plan = createHydrationPlan(stored, songs);
  const result = await applyHydratedNativeQueue({ plan, nativeQueueRef: state.nativeQueueRef, targets: state, isCancelled: () => false });
  expect(result.nativeStatus).toBe('applied');
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
    plan, nativeQueueRef: state.nativeQueueRef, targets: state,
    librarySongs: songs, isCancelled: () => false,
  });

  expect(result).toMatchObject({ nativeStatus: 'applied', verifiedState: 'confirmed', queue: [], activeSong: null });
  expect(player.__getQueue()).toEqual([]);
  expect(state.nativeQueueRef.current).toEqual([]);
  expect(state.queueContextRef.current).toEqual([]);
  expect(state.setCurrentSong).toHaveBeenCalledWith(null);
  expect(removeSpy).toHaveBeenCalled();
  expect(plan.hydratedSongs).toEqual(songs);
  expect(plan.normalizedPlaylists).toBe(stored.playlists);
});

test('full hydration reject after native side effect reconciles the full queue', async () => {
  const state = targets(); const plan = createHydrationPlan(stored, songs);
  const add = (TrackPlayer.add as jest.Mock).getMockImplementation()!;
  (TrackPlayer.add as jest.Mock).mockImplementationOnce(async (...args: unknown[]) => { await add(...args); throw new Error('ack'); });
  const result = await applyHydratedNativeQueue({ plan, nativeQueueRef: state.nativeQueueRef, targets: state, isCancelled: () => false });
  expect(result.nativeStatus).toBe('reconciled');
  expectVerified(result);
  expect(result.queue).toEqual(songs);
});

test('partial hydration reject publishes only known tracks actually present', async () => {
  const state = targets(); const plan = createHydrationPlan(stored, songs);
  const add = (TrackPlayer.add as jest.Mock).getMockImplementation()!;
  (TrackPlayer.add as jest.Mock).mockImplementationOnce(async (tracks: Song[]) => { await add(tracks[0]); throw new Error('partial'); });
  const result = await applyHydratedNativeQueue({ plan, nativeQueueRef: state.nativeQueueRef, targets: state, isCancelled: () => false });
  expect(result.nativeStatus).toBe('reconciled');
  expectVerified(result);
  expect(result.queue).toEqual([songs[0]]);
  expect(result.baseQueue).toEqual([songs[0]]);
});


test.each([
  ['initialize', stored],
  ['none', { ...stored, currentSongId: null }],
] as const)('cancellation after snapshot prevents every %s side effect', async (_label, storedState) => {
  const state = targets();
  state.nativeQueueRef.current = songs.slice();
  state.queueContextRef.current = songs.slice();
  state.baseQueueContextRef.current = songs.slice();
  const snapshotStarted = deferred(); const releaseSnapshot = deferred(); let cancelled = false;
  const getQueue = (TrackPlayer.getQueue as jest.Mock).getMockImplementation()!;
  (TrackPlayer.getQueue as jest.Mock).mockImplementationOnce(async () => {
    snapshotStarted.resolve(); await releaseSnapshot.promise; return getQueue();
  });
  const setSpy = jest.spyOn(storage, 'set'); const removeSpy = jest.spyOn(storage, 'remove');
  const promise = applyHydratedNativeQueue({
    plan: createHydrationPlan(storedState, songs), nativeQueueRef: state.nativeQueueRef,
    targets: state, isCancelled: () => cancelled,
  });
  await snapshotStarted.promise; cancelled = true; releaseSnapshot.resolve();
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
  expect(setSpy).not.toHaveBeenCalled(); expect(removeSpy).not.toHaveBeenCalled();
});

test('cancellation during an effective add still commits confirmed native truth', async () => {
  const state = targets(); const plan = createHydrationPlan(stored, songs);
  const started = deferred(); const release = deferred(); let cancelled = false;
  const add = (TrackPlayer.add as jest.Mock).getMockImplementation()!;
  (TrackPlayer.add as jest.Mock).mockImplementationOnce(async (...args: unknown[]) => {
    await add(...args); started.resolve(); await release.promise;
  });
  const promise = applyHydratedNativeQueue({ plan, nativeQueueRef: state.nativeQueueRef, targets: state, isCancelled: () => cancelled });
  await started.promise; cancelled = true; release.resolve();
  const result = await promise;
  expectVerified(result);
  expect(result.queue).toEqual(songs);
  expect(state.queueContextRef.current).toEqual(songs);
});

test('cancellation after successful reset commits the confirmed empty native queue', async () => {
  const state = targets(); const plan = createHydrationPlan(stored, songs); let cancelled = false;
  const reset = (TrackPlayer.reset as jest.Mock).getMockImplementation()!;
  (TrackPlayer.reset as jest.Mock).mockImplementationOnce(async () => { await reset(); cancelled = true; });
  const result = await applyHydratedNativeQueue({ plan, nativeQueueRef: state.nativeQueueRef, targets: state, isCancelled: () => cancelled });
  expect(result.nativeStatus).toBe('reconciled');
  expect(state.queueContextRef.current).toEqual([]);
  expect(state.setCurrentSong).toHaveBeenCalledWith(null);
});

test('queue with no active track persists no invented current song', async () => {
  const state = targets(); const plan = createHydrationPlan(stored, songs);
  (TrackPlayer.add as jest.Mock).mockImplementationOnce(async () => undefined);
  (TrackPlayer.getQueue as jest.Mock).mockResolvedValue(songs);
  (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue(undefined);
  (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(undefined);
  const result = await applyHydratedNativeQueue({ plan, nativeQueueRef: state.nativeQueueRef, targets: state, isCancelled: () => false });
  expectVerified(result);
  expect(result.activeSong).toBeNull();
  expect(state.setCurrentSong).toHaveBeenCalledWith(null);
});

test('early cancellation with an existing queue never invents an empty verified state', async () => {
  await TrackPlayer.add(songs.map(song => ({ ...song, url: song.uri! })));
  const state = targets(); state.nativeQueueRef.current = songs.slice();
  state.queueContextRef.current = songs.slice(); state.baseQueueContextRef.current = songs.slice();
  const result = await applyHydratedNativeQueue({
    plan: createHydrationPlan(stored, songs), nativeQueueRef: state.nativeQueueRef,
    targets: state, isCancelled: () => true,
  });
  expect(result).toMatchObject({ nativeStatus: 'cancelled', verifiedState: null });
  expect(result).not.toHaveProperty('queue');
  expect(result.verifiedState === null && result.lastKnownUnverifiedState.nativeQueueRef).toEqual(songs);
});

test('snapshot failure is classified without publishing ref contents as verified queue', async () => {
  const state = targets(); state.nativeQueueRef.current = songs.slice();
  (TrackPlayer.getQueue as jest.Mock).mockRejectedValueOnce(new Error('snapshot failed'));
  const result = await applyHydratedNativeQueue({
    plan: createHydrationPlan(stored, songs), nativeQueueRef: state.nativeQueueRef,
    targets: state, isCancelled: () => false,
  });
  expect(result).toMatchObject({ nativeStatus: 'failed', verifiedState: null, failureStage: 'snapshot' });
  expect(result).not.toHaveProperty('queue');
});
