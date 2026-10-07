import TrackPlayer, { RepeatMode, State } from 'react-native-track-player';
import { waitFor } from '@testing-library/react-native';
import type { Song } from '../../types/Song';
import { runPlaySongQueueAction, runShuffleQueueAction } from '../../contexts/playbackQueueActionHelpers';
import { skipToNextSafely, skipToPreviousOrRestart, skipToPreviousTrackSafely, toggleTrackPlayerPlayback } from '../../contexts/playbackControlHelpers';
import { acquireNativeHydrationGate, publishNativeHydrationGate, resetNativeHydrationGateForTests } from '../nativeHydrationGate';
import { resetNativeQueueMutationLockForTests, runExclusiveNativePlaybackControl, runExclusiveNativeQueueReplacement } from '../nativeQueueMutationLock';
import { acknowledgeNativePlaybackRecovery, getNativePlaybackWatchdogSnapshot, NativePlaybackTimeoutError, NATIVE_QUEUE_DEADLINE_MS } from '../nativePlaybackWatchdog';
import { requestLatestSeek, resetSeekControllerForTests, isSeekDrainingForTests } from '../seekController';
import { enqueuePlaybackIntent } from '../playbackIntentScheduler';

const player = TrackPlayer as typeof TrackPlayer & { __reset: () => void; __getState: () => State };
const nativeAdd = (TrackPlayer.add as jest.Mock).getMockImplementation()!;
const nativeReset = (TrackPlayer.reset as jest.Mock).getMockImplementation()!;
const songs: Song[] = Array.from({ length: 40 }, (_, index) => ({
  id: `s${index}`, title: `Song ${index}`, artist: 'Test', uri: `file:///s${index}.mp3`,
}));
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};
const queueArgs = (queue: Song[]) => ({
  songsRef: { current: songs }, queueContextRef: { current: queue.slice() },
  baseQueueContextRef: { current: queue.slice() }, nativeQueueRef: { current: queue.slice() },
  setCurrentSong: jest.fn(), setPlaybackQueue: jest.fn(), setShuffle: jest.fn(), shuffle: false,
});
const seed = async (queue = songs, index = 0) => {
  await TrackPlayer.add(queue.map(song => ({ id: song.id, url: song.uri! })));
  if (index > 0) await TrackPlayer.skip(index);
  jest.clearAllMocks();
};

beforeEach(() => {
  jest.useRealTimers();
  resetNativeQueueMutationLockForTests();
  resetSeekControllerForTests();
  resetNativeHydrationGateForTests();
  publishNativeHydrationGate(acquireNativeHydrationGate(), 'ready');
  player.__reset();
  jest.clearAllMocks();
});

afterEach(() => { jest.useRealTimers(); });

test('timed-out native writer stays held, fences late commit, and exposes truthful retry state', async () => {
  jest.useFakeTimers();
  const release = deferred(); const started = deferred(); const commit = jest.fn();
  const operation = runExclusiveNativeQueueReplacement(async context => {
    context.beginNativeMutation(); started.resolve(); await release.promise;
    if (context.isCurrent()) commit();
  }, { timeoutMs: 40, requireStableReadyHydration: true });
  const outcome = expect(operation).rejects.toBeInstanceOf(NativePlaybackTimeoutError);
  await started.promise;
  const successor = jest.fn(async () => undefined);
  const queued = runExclusiveNativePlaybackControl(successor, { timeoutMs: 2000 });
  await jest.advanceTimersByTimeAsync(40);
  await outcome;
  expect(getNativePlaybackWatchdogSnapshot().status).toBe('quarantined');
  expect(acknowledgeNativePlaybackRecovery()).toBe(false);
  await expect(runExclusiveNativeQueueReplacement(successor)).rejects.toMatchObject({ name: 'NativePlaybackQuarantinedError' });
  expect(successor).not.toHaveBeenCalled();
  release.resolve(); await queued;
  expect(commit).not.toHaveBeenCalled();
  expect(successor).toHaveBeenCalledTimes(1);
  expect(getNativePlaybackWatchdogSnapshot().status).toBe('retry-required');
  expect(acknowledgeNativePlaybackRecovery()).toBe(true);
});

test('a late add after timeout cannot play or commit the old target', async () => {
  jest.useFakeTimers();
  const release = deferred(); const started = deferred(); const args = queueArgs([]);
  (TrackPlayer.add as jest.Mock).mockImplementationOnce(async (...values: unknown[]) => {
    started.resolve(); await release.promise; await nativeAdd(...values);
  });
  const operation = runPlaySongQueueAction({ ...args, song: songs[3] });
  await started.promise;
  await jest.advanceTimersByTimeAsync(NATIVE_QUEUE_DEADLINE_MS);
  await expect(operation).resolves.toMatchObject({ status: 'failed', error: { name: 'NativePlaybackTimeoutError' } });
  expect(getNativePlaybackWatchdogSnapshot().status).toBe('quarantined');
  release.resolve();
  await jest.advanceTimersByTimeAsync(0);
  expect(TrackPlayer.play).not.toHaveBeenCalled();
  expect(args.setCurrentSong).not.toHaveBeenCalled();
  expect(getNativePlaybackWatchdogSnapshot().status).toBe('retry-required');
});

test('a late reset does not overwrite the last confirmed JS queue after timeout', async () => {
  await seed(songs.slice(0, 2));
  jest.useFakeTimers();
  const release = deferred(); const started = deferred(); const args = queueArgs(songs.slice(0, 2));
  (TrackPlayer.reset as jest.Mock).mockImplementationOnce(async () => {
    started.resolve(); await release.promise; await nativeReset();
  });
  const operation = runPlaySongQueueAction({ ...args, song: songs[3] });
  await started.promise;
  await jest.advanceTimersByTimeAsync(NATIVE_QUEUE_DEADLINE_MS);
  await expect(operation).resolves.toMatchObject({ status: 'failed' });
  release.resolve(); await jest.advanceTimersByTimeAsync(0);
  expect(args.nativeQueueRef.current).toEqual(songs.slice(0, 2));
  expect(args.setCurrentSong).not.toHaveBeenCalled();
  expect(TrackPlayer.add).not.toHaveBeenCalled();
});

test('seek timeout bounds the caller and still drains the actual seek before queue mutation', async () => {
  jest.useFakeTimers();
  const release = deferred(); const seek = jest.fn(() => release.promise);
  const outcome = requestLatestSeek(5000, seek, { timeoutMs: 40 });
  const mutate = jest.fn(async () => undefined);
  const replacement = runExclusiveNativeQueueReplacement(mutate, { timeoutMs: 2000 });
  await jest.advanceTimersByTimeAsync(40);
  await expect(outcome).resolves.toMatchObject({ status: 'failed', error: { name: 'NativePlaybackTimeoutError' } });
  expect(isSeekDrainingForTests()).toBe(true);
  await expect(requestLatestSeek(9000, seek, { songIdentity: { id: 'any' } })).resolves.toMatchObject({
    status: 'failed', error: { name: 'NativePlaybackQuarantinedError' },
  });
  expect(mutate).not.toHaveBeenCalled();
  release.resolve(); await replacement;
  expect(mutate).toHaveBeenCalledTimes(1);
});

test('an applied seek settles independently of a later hung seek and its deadline', async () => {
  jest.useFakeTimers();
  const firstFlight = deferred(); const secondFlight = deferred(); const secondStarted = deferred();
  const seek = jest.fn().mockReturnValueOnce(firstFlight.promise).mockImplementationOnce(() => {
    secondStarted.resolve(); return secondFlight.promise;
  });
  const settledFirst = jest.fn();
  const first = requestLatestSeek(1000, seek, { timeoutMs: 40 });
  void first.then(settledFirst);
  const second = requestLatestSeek(9000, seek, { timeoutMs: 40 });
  firstFlight.resolve(); await secondStarted.promise;
  const mutate = jest.fn(async () => undefined);
  const replacement = runExclusiveNativeQueueReplacement(mutate, { timeoutMs: 2000 });
  await jest.advanceTimersByTimeAsync(40);
  try {
    await expect(second).resolves.toMatchObject({ status: 'failed', error: { name: 'NativePlaybackTimeoutError' } });
    expect(settledFirst).toHaveBeenCalledWith({ status: 'applied' });
    expect(isSeekDrainingForTests()).toBe(true);
    expect(mutate).not.toHaveBeenCalled();
  } finally { secondFlight.resolve(); await replacement; }
  await expect(first).resolves.toEqual({ status: 'applied' });
  expect(mutate).toHaveBeenCalledTimes(1);
});

test.each([false, true])('blocked seek retains latest position only for the same confirmed song (track changed: %s)', async changed => {
  await seed(songs.slice(0, 2));
  const started = deferred(); const release = deferred();
  const mutation = runExclusiveNativePlaybackControl(async () => {
    started.resolve(); await release.promise; if (changed) await TrackPlayer.skip(1);
  }, { invalidatesPendingSeek: true });
  await started.promise;
  const seek = jest.fn(async () => undefined);
  const options = { songIdentity: { id: songs[0].id, uri: songs[0].uri }, requireStableReadyHydration: true };
  await expect(requestLatestSeek(2000, seek, options)).resolves.toEqual({ status: 'deferred' });
  await expect(requestLatestSeek(7000, seek, options)).resolves.toEqual({ status: 'deferred' });
  release.resolve(); await mutation;
  await waitFor(() => expect(isSeekDrainingForTests()).toBe(false));
  expect(seek.mock.calls).toEqual(changed ? [] : [[7]]);
});

test('deferred seek rejects the same song id after its source URI changes', async () => {
  await seed(songs.slice(0, 1));
  const started = deferred(); const release = deferred();
  const mutation = runExclusiveNativePlaybackControl(async () => {
    started.resolve(); await release.promise;
    await TrackPlayer.reset(); await TrackPlayer.add({ id: songs[0].id, url: 'file:///replacement.mp3' });
  }, { invalidatesPendingSeek: true });
  await started.promise;
  const seek = jest.fn(async () => undefined);
  await requestLatestSeek(7000, seek, { songIdentity: { id: songs[0].id, uri: songs[0].uri } });
  release.resolve(); await mutation;
  await waitFor(() => expect(isSeekDrainingForTests()).toBe(false));
  expect(seek).not.toHaveBeenCalled();
});

test('a pause requested during reset wins over play-song restoration', async () => {
  await seed(songs.slice(0, 2)); await TrackPlayer.play(); jest.clearAllMocks();
  const started = deferred(); const release = deferred(); const args = queueArgs(songs.slice(0, 2));
  (TrackPlayer.reset as jest.Mock).mockImplementationOnce(async () => {
    started.resolve(); await release.promise; await nativeReset();
  });
  const play = runPlaySongQueueAction({ ...args, song: songs[5] });
  await started.promise;
  const pause = toggleTrackPlayerPlayback(true);
  release.resolve(); await Promise.all([play, pause]);
  expect(TrackPlayer.play).not.toHaveBeenCalled();
  expect(player.__getState()).toBe(State.Paused);
  expect(args.setCurrentSong).toHaveBeenCalledWith(songs[5]);
});

test('a pause during shuffle snapshot preparation prevents resuming playback', async () => {
  await seed(songs.slice(0, 3)); await TrackPlayer.play(); jest.clearAllMocks();
  const started = deferred(); const release = deferred();
  (TrackPlayer.getProgress as jest.Mock).mockImplementationOnce(async () => {
    started.resolve(); await release.promise; return { position: 5, duration: 100, buffered: 10 };
  });
  const shuffle = runShuffleQueueAction({ ...queueArgs(songs.slice(0, 3)), currentSongId: songs[0].id });
  await started.promise;
  const pause = toggleTrackPlayerPlayback(true);
  release.resolve(); await Promise.all([shuffle, pause]);
  expect(TrackPlayer.play).not.toHaveBeenCalled();
  expect(player.__getState()).toBe(State.Paused);
});

test.each([false, true])('play confirmation uses four full queue reads (reuse: %s)', async reuse => {
  if (reuse) await seed(songs);
  const args = queueArgs(reuse ? songs : []);
  const result = await runPlaySongQueueAction({ ...args, song: songs[3], queue: songs });
  expect(result.status).toBe('applied');
  expect(TrackPlayer.getQueue).toHaveBeenCalledTimes(4);
  expect(args.setCurrentSong).toHaveBeenCalledWith(songs[3]);
});

test('30 rapid Next taps resolve one native target without dropping taps', async () => {
  await seed();
  await Promise.all(Array.from({ length: 30 }, () => skipToNextSafely()));
  expect(await TrackPlayer.getActiveTrackIndex()).toBe(30);
  expect(TrackPlayer.skip).toHaveBeenCalledTimes(1);
  expect(TrackPlayer.skip).toHaveBeenCalledWith(30);
});

test('mixed Next/Previous taps preserve deltas and repeat-all boundaries', async () => {
  await seed(songs.slice(0, 3), 1); await TrackPlayer.setRepeatMode(RepeatMode.Queue);
  await Promise.all([skipToNextSafely(), skipToNextSafely(), skipToPreviousTrackSafely()]);
  expect(await TrackPlayer.getActiveTrackIndex()).toBe(2);
});

test.each([
  { repeat: RepeatMode.Queue, taps: 1, expected: 2 },
  { repeat: RepeatMode.Queue, taps: 4, expected: 2 },
  { repeat: RepeatMode.Off, taps: 1, expected: 0 },
  { repeat: RepeatMode.Track, taps: 1, expected: 0 },
])('explicit Previous from the first track respects repeat $repeat with $taps taps', async ({ repeat, taps, expected }) => {
  await seed(songs.slice(0, 3));
  await TrackPlayer.setRepeatMode(repeat);
  await Promise.all(Array.from({ length: taps }, () => skipToPreviousTrackSafely()));
  expect(await TrackPlayer.getActiveTrackIndex()).toBe(expected);
});

test('two Previous taps at the repeat-all start restart after three seconds then wrap', async () => {
  await seed(songs.slice(0, 3));
  await TrackPlayer.setRepeatMode(RepeatMode.Queue);
  (TrackPlayer.getProgress as jest.Mock).mockResolvedValueOnce({ position: 5, duration: 100, buffered: 10 });
  await Promise.all([skipToPreviousOrRestart(), skipToPreviousOrRestart()]);
  expect(await TrackPlayer.getActiveTrackIndex()).toBe(2);
});

test('two previous taps after three seconds restart once then navigate back', async () => {
  await seed(songs, 10);
  (TrackPlayer.getProgress as jest.Mock).mockResolvedValueOnce({ position: 5, duration: 100, buffered: 10 });
  await Promise.all([skipToPreviousOrRestart(), skipToPreviousOrRestart()]);
  expect(await TrackPlayer.getActiveTrackIndex()).toBe(9);
});

test('a title selection is ordered before subsequent Next taps', async () => {
  await seed(); const args = queueArgs(songs);
  const selection = enqueuePlaybackIntent(() => runPlaySongQueueAction({ ...args, song: songs[10] }), 'selection');
  await Promise.all([selection, skipToNextSafely(), skipToNextSafely()]);
  expect(await TrackPlayer.getActiveTrackIndex()).toBe(12);
});

test('navigation retries a track-end race before sending its target', async () => {
  await seed();
  (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValueOnce({ id: 'during-transition', url: 'file:///transition.mp3' });
  await skipToNextSafely();
  expect(await TrackPlayer.getActiveTrackIndex()).toBe(1);
  expect(TrackPlayer.getQueue).toHaveBeenCalledTimes(2);
  expect(TrackPlayer.skip).toHaveBeenCalledTimes(1);
});
