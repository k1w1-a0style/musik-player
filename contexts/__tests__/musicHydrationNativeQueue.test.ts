import TrackPlayer, { State } from 'react-native-track-player';
import type { Song } from '../../types/Song';
import { resetNativeQueueMutationLockForTests } from '../../utils/nativeQueueMutationLock';
import { createHydrationPlan } from '../musicHydrationPlan';
import { applyHydratedNativeQueue } from '../musicHydrationNativeQueue';

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

beforeEach(() => { player.__reset(); restore(); jest.clearAllMocks(); restore(); resetNativeQueueMutationLockForTests(); });

test('successful hydration commits only full native readback', async () => {
  const state = targets(); const plan = createHydrationPlan(stored, songs);
  const result = await applyHydratedNativeQueue({ plan, nativeQueueRef: state.nativeQueueRef, targets: state, isCancelled: () => false });
  expect(result.nativeStatus).toBe('applied');
  expect(state.queueContextRef.current).toEqual(songs);
  expect(state.setCurrentSong).toHaveBeenCalledWith(songs[0]);
});

test('full hydration reject after native side effect reconciles the full queue', async () => {
  const state = targets(); const plan = createHydrationPlan(stored, songs);
  const add = (TrackPlayer.add as jest.Mock).getMockImplementation()!;
  (TrackPlayer.add as jest.Mock).mockImplementationOnce(async (...args: unknown[]) => { await add(...args); throw new Error('ack'); });
  const result = await applyHydratedNativeQueue({ plan, nativeQueueRef: state.nativeQueueRef, targets: state, isCancelled: () => false });
  expect(result.nativeStatus).toBe('reconciled');
  expect(result.queue).toEqual(songs);
});

test('partial hydration reject publishes only known tracks actually present', async () => {
  const state = targets(); const plan = createHydrationPlan(stored, songs);
  const add = (TrackPlayer.add as jest.Mock).getMockImplementation()!;
  (TrackPlayer.add as jest.Mock).mockImplementationOnce(async (tracks: Song[]) => { await add(tracks[0]); throw new Error('partial'); });
  const result = await applyHydratedNativeQueue({ plan, nativeQueueRef: state.nativeQueueRef, targets: state, isCancelled: () => false });
  expect(result.nativeStatus).toBe('reconciled');
  expect(result.queue).toEqual([songs[0]]);
  expect(result.baseQueue).toEqual([songs[0]]);
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
  expect(result.activeSong).toBeNull();
  expect(state.setCurrentSong).toHaveBeenCalledWith(null);
});
