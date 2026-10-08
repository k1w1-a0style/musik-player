import React from 'react';
import * as ReactNative from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import type { MediaItem } from '@rntp/player';

const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

/** Only the native boundary is mocked. Both the facade and V5 JS execute. */
const createNative = () => ({
  setupPlayer: jest.fn(), destroy: jest.fn(),
  awaitReady: jest.fn().mockResolvedValue(undefined),
  awaitPlaybackCommands: jest.fn().mockResolvedValue(undefined),
  getPlayWhenReady: jest.fn().mockReturnValue(false),
  getAudioSessionId: jest.fn().mockResolvedValue(17),
  getPlaybackState: jest.fn().mockReturnValue('idle'),
  isPlaying: jest.fn().mockReturnValue(false),
  getProgress: jest.fn().mockReturnValue({ position: 12.5, duration: 120, buffered: 30 }),
  getQueue: jest.fn<MediaItem[], []>().mockReturnValue([]),
  getActiveMediaItem: jest.fn<MediaItem | null, []>().mockReturnValue(null),
  getActiveMediaItemIndex: jest.fn().mockReturnValue(null),
  getRepeatMode: jest.fn().mockReturnValue('off'),
  addMediaItems: jest.fn(), insertMediaItems: jest.fn(),
  skipToIndex: jest.fn(), moveMediaItem: jest.fn(), updateMetadata: jest.fn(),
  setRepeatMode: jest.fn(), setVolume: jest.fn(), setCommands: jest.fn(),
  play: jest.fn(), pause: jest.fn(), stop: jest.fn(), clear: jest.fn(),
  seekTo: jest.fn(), seekBy: jest.fn(),
  setRemoteHandlers: jest.fn(), acceptRemoteCommand: jest.fn().mockReturnValue(true),
  performRemoteDefault: jest.fn(), consumeRemoteCommand: jest.fn(), completeHeadlessTask: jest.fn(),
  addListener: jest.fn(), removeListeners: jest.fn(),
});

type Adapter = typeof import('../index');
type HeadlessData = { event: string; payload?: Record<string, unknown>; rntpTaskToken?: string };
let adapter: Adapter;
let controls: typeof import('../../../contexts/playbackControlHelpers');
let watchdog: typeof import('../../../utils/nativePlaybackWatchdog');
let libraryHelpers: typeof import('../../../contexts/libraryActionHelpers');
let native: ReturnType<typeof createNative>;
let headlessTask: (data: HeadlessData) => Promise<void>;

const flush = async () => { for (let count = 0; count < 12; count += 1) await Promise.resolve(); };

beforeEach(() => {
  native = createNative();
  jest.replaceProperty(ReactNative.Platform, 'OS', 'android');
  const getEnforcing = ReactNative.TurboModuleRegistry.getEnforcing;
  jest.spyOn(ReactNative.TurboModuleRegistry, 'getEnforcing').mockImplementation(name =>
    name === 'TrackPlayer' ? native as never : getEnforcing(name) as never);
  jest.spyOn(ReactNative.AppRegistry, 'registerHeadlessTask').mockImplementation((_name, factory) => {
    headlessTask = factory() as typeof headlessTask;
  });
  // Isolate player state without creating a second React renderer or RN emitter.
  const nativeExports = {
    Platform: ReactNative.Platform, TurboModuleRegistry: ReactNative.TurboModuleRegistry,
    AppRegistry: ReactNative.AppRegistry, NativeEventEmitter: ReactNative.NativeEventEmitter,
    AppState: ReactNative.AppState, Image: ReactNative.Image,
    requireNativeComponent: ReactNative.requireNativeComponent,
  };
  jest.doMock('react', () => React);
  jest.doMock('react-native', () => nativeExports);
  jest.isolateModules(() => {
    adapter = jest.requireActual<Adapter>('../index');
    jest.doMock('react-native-track-player', () => adapter);
    controls = jest.requireActual<typeof controls>('../../../contexts/playbackControlHelpers');
    watchdog = jest.requireActual<typeof watchdog>('../../../utils/nativePlaybackWatchdog');
    libraryHelpers = jest.requireActual<typeof libraryHelpers>('../../../contexts/libraryActionHelpers');
  });
});

afterEach(() => {
  ReactNative.DeviceEventEmitter.removeAllListeners();
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.dontMock('react-native-track-player');
});

test.each(['volume', 'repeat'] as const)('%s bounds a hung native startup without releasing its adapter writer', async setting => {
  jest.useFakeTimers();
  const ready = deferred();
  native.awaitReady.mockReturnValueOnce(ready.promise);
  const apply = () => setting === 'volume' ? controls.applyVolumeToTrackPlayer(0.3) : controls.applyRepeatModeToTrackPlayer('all');
  const outcome = apply().catch(error => error);
  await flush();
  await jest.advanceTimersByTimeAsync(watchdog.NATIVE_PLAYBACK_DEADLINE_MS);
  expect(await outcome).toMatchObject({ name: 'NativePlaybackTimeoutError' });
  expect(watchdog.getNativePlaybackWatchdogSnapshot()).toMatchObject({ status: 'quarantined', lane: 'control' });
  expect(native.setVolume).not.toHaveBeenCalled();
  expect(native.setRepeatMode).not.toHaveBeenCalled();
  const pause = adapter.default.pause();
  await flush();
  expect(native.pause).not.toHaveBeenCalled();
  ready.resolve();
  await pause;
  await flush();
  expect(native.pause).toHaveBeenCalledTimes(1);
  expect(watchdog.getNativePlaybackWatchdogSnapshot().status).toBe('retry-required');
});

test.each([false, true])('volume timeout retains native settlement and reports recovery after late failure %s', async fails => {
  jest.useFakeTimers();
  const acknowledgement = deferred();
  native.awaitPlaybackCommands.mockReturnValueOnce(acknowledgement.promise);
  const outcome = controls.applyVolumeToTrackPlayer(0.3).catch(error => error);
  await flush();
  expect(native.setVolume).toHaveBeenCalledWith(0.3);
  await jest.advanceTimersByTimeAsync(watchdog.NATIVE_PLAYBACK_DEADLINE_MS);
  expect(await outcome).toMatchObject({ name: 'NativePlaybackTimeoutError' });
  await expect(controls.applyVolumeToTrackPlayer(0.6)).rejects.toMatchObject({ name: 'NativePlaybackQuarantinedError' });
  const pause = adapter.default.pause();
  const readback = adapter.default.getQueue();
  await flush();
  expect(native.pause).not.toHaveBeenCalled();
  expect(native.getQueue).not.toHaveBeenCalled();
  if (fails) acknowledgement.reject(new Error('late native failure'));
  else acknowledgement.resolve();
  await Promise.all([pause, readback]);
  expect(native.pause).toHaveBeenCalledTimes(1);
  expect(native.getQueue).toHaveBeenCalledTimes(1);
  expect(watchdog.getNativePlaybackWatchdogSnapshot().status).toBe('retry-required');
  expect(watchdog.acknowledgeNativePlaybackRecovery()).toBe(true);
  await controls.applyVolumeToTrackPlayer(0.6);
  expect(native.setVolume.mock.calls).toEqual([[0.3], [0.6]]);
});

test('waits for actual native startup and preserves the current service defaults', async () => {
  const ready = deferred();
  native.awaitReady.mockReturnValue(ready.promise);
  let settled = false;
  const setup = adapter.default.setupPlayer({ autoHandleInterruptions: true }).then(() => { settled = true; });
  await flush();
  expect(native.setupPlayer).toHaveBeenCalledWith(expect.objectContaining({
    audioMixing: 'exclusive', progressSync: { intervalSeconds: 2 },
    android: expect.objectContaining({ taskRemovedBehavior: 'stop', autoStartJs: true }),
  }));
  expect(settled).toBe(false);
  ready.resolve();
  await setup;
  expect(settled).toBe(true);
});

test('does not expose the empty startup defaults while a real queue is connecting', async () => {
  const ready = deferred();
  native.awaitReady.mockReturnValue(ready.promise);
  native.getQueue.mockReturnValue([{ mediaId: 'song', url: 'content://music/song' }]);
  const queue = adapter.default.getQueue();
  await flush();
  expect(native.getQueue).not.toHaveBeenCalled();
  ready.resolve();
  await expect(queue).resolves.toEqual([expect.objectContaining({ id: 'song', url: 'content://music/song' })]);
});

test('navigation avoids full compatibility conversions across 2000 tracks while preserving every rapid tap', async () => {
  const convertMetadata = jest.fn(() => { throw new Error('Full metadata conversion is unnecessary for navigation.'); });
  const items = Array.from({ length: 2000 }, (_, index) => Object.defineProperties({
    mediaId: `s${index}`, title: `Song ${index}`,
  }, { url: { get: convertMetadata }, extras: { get: convertMetadata } }) as MediaItem);
  native.getQueue.mockReturnValue(items);
  native.getActiveMediaItemIndex.mockReturnValue(0);
  native.getActiveMediaItem.mockReturnValue(items[0]);
  await Promise.all(Array.from({ length: 30 }, () => controls.skipToNextSafely()));
  expect(native.skipToIndex.mock.calls).toEqual([[30]]);
  expect(convertMetadata).not.toHaveBeenCalled();
  expect(native.getQueue).toHaveBeenCalledTimes(2); // snapshot + bounds validation at the native write
});

test('compact snapshots await native settlement and reflect external queue changes without a cache', async () => {
  const acknowledgement = deferred();
  const original = [{ mediaId: 'a', title: 'A', url: 'file:///a' }];
  native.getQueue.mockReturnValue(original);
  native.getActiveMediaItemIndex.mockReturnValue(0);
  native.getActiveMediaItem.mockReturnValue(original[0]);
  native.awaitPlaybackCommands.mockReturnValueOnce(acknowledgement.promise);
  const play = adapter.default.play();
  const snapshot = adapter.default.getNavigationSnapshot();
  await flush();
  expect(native.getQueue).not.toHaveBeenCalled();
  acknowledgement.resolve();
  await play;
  await expect(snapshot).resolves.toEqual({
    queue: [{ id: 'a', title: 'A' }], index: 0, activeTrackId: 'a', repeatMode: adapter.RepeatMode.Off,
  });
  const external = [{ mediaId: 'b', title: 'B', url: 'file:///b' }];
  native.getQueue.mockReturnValue(external);
  native.getActiveMediaItem.mockReturnValue(external[0]);
  native.getRepeatMode.mockReturnValue('all');
  await expect(adapter.default.getNavigationSnapshot()).resolves.toEqual({
    queue: [{ id: 'b', title: 'B' }], index: 0, activeTrackId: 'b', repeatMode: adapter.RepeatMode.Queue,
  });
});

test('navigation retries inconsistent external track transitions before resolving its target', async () => {
  const items = Array.from({ length: 3 }, (_, index) => ({ mediaId: `s${index}`, url: `file:///s${index}` }));
  native.getQueue.mockReturnValue(items);
  native.getActiveMediaItemIndex.mockReturnValue(0);
  native.getActiveMediaItem.mockReturnValueOnce(items[1]).mockReturnValue(items[0]);
  await controls.skipToNextSafely();
  expect(native.getActiveMediaItem).toHaveBeenCalledTimes(2);
  expect(native.skipToIndex.mock.calls).toEqual([[1]]);
});

test('coalesces startup and retries after a genuine connection failure', async () => {
  const ready = deferred();
  native.awaitReady.mockReturnValueOnce(ready.promise);
  const first = adapter.default.setupPlayer();
  expect(adapter.default.setupPlayer()).toBe(first);
  const rejected = expect(first).rejects.toThrow('configuration rejected');
  ready.reject(new Error('configuration rejected'));
  await rejected;
  expect(native.destroy).toHaveBeenCalledTimes(1);
  await adapter.default.setupPlayer();
  expect(native.setupPlayer).toHaveBeenCalledTimes(2);
});

test('reconnects during setup after a previously healthy controller disconnects', async () => {
  await adapter.default.setupPlayer();
  native.awaitReady.mockRejectedValueOnce(new Error('controller disconnected'));
  await adapter.default.setupPlayer();
  expect(native.destroy).toHaveBeenCalledTimes(1);
  expect(native.setupPlayer).toHaveBeenCalledTimes(2);
});

test('rejects use of an unpatched native binary rather than pretending writes settled', async () => {
  delete (native as Partial<typeof native>).awaitPlaybackCommands;
  await expect(adapter.default.play()).rejects.toThrow('acknowledgement patch is missing');
  expect(native.play).not.toHaveBeenCalled();
});

test('does not start a second writer or publish reads before the first native acknowledgement', async () => {
  const acknowledged = deferred();
  native.awaitPlaybackCommands.mockReturnValueOnce(acknowledged.promise);
  let playSettled = false;
  const play = adapter.default.play().then(() => { playSettled = true; });
  const pause = adapter.default.pause();
  const queue = adapter.default.getQueue();
  await flush();
  expect(native.play).toHaveBeenCalledTimes(1);
  expect(native.pause).not.toHaveBeenCalled();
  expect(native.getQueue).not.toHaveBeenCalled();
  expect(playSettled).toBe(false);
  acknowledged.resolve();
  await Promise.all([play, pause, queue]);
  expect(native.pause).toHaveBeenCalledTimes(1);
  expect(native.getQueue).toHaveBeenCalledTimes(1);
});

test('propagates delayed native operation errors and permits later recovery', async () => {
  const acknowledged = deferred();
  native.awaitPlaybackCommands.mockReturnValueOnce(acknowledged.promise);
  const play = adapter.default.play();
  const rejected = expect(play).rejects.toThrow('native source failed');
  await flush();
  acknowledged.reject(new Error('native source failed'));
  await rejected;
  await adapter.default.pause();
  expect(native.pause).toHaveBeenCalledTimes(1);
});

test('a JS deadline never releases a still-running native writer', async () => {
  jest.useFakeTimers();
  const acknowledged = deferred();
  native.awaitPlaybackCommands.mockReturnValueOnce(acknowledged.promise);
  const play = adapter.default.play();
  const pause = adapter.default.pause();
  await flush();
  jest.advanceTimersByTime(60_000);
  await flush();
  expect(native.pause).not.toHaveBeenCalled();
  acknowledged.resolve();
  await Promise.all([play, pause]);
});

test('reset waits for stop before clearing the queue and dropping play intent', async () => {
  const acknowledged = deferred();
  native.awaitPlaybackCommands.mockReturnValueOnce(acknowledged.promise);
  const reset = adapter.default.reset();
  await flush();
  expect(native.stop).toHaveBeenCalledTimes(1);
  expect(native.clear).not.toHaveBeenCalled();
  acknowledged.resolve();
  await reset;
  expect(native.clear).toHaveBeenCalledTimes(1);
  expect(native.awaitPlaybackCommands).toHaveBeenCalledTimes(2);
});

test('round trips V4 song identity, display metadata, seconds, headers and extras through real V5', async () => {
  const song = {
    id: 'track-1', url: '/music/test.mp3', title: 'Title', artist: 'Artist', album: 'Album',
    artwork: 'file:///covers/test.jpg', duration: 181.25, genre: 'Techno',
    headers: { Authorization: 'test' },
  };
  await adapter.default.add(song);
  const items = native.addMediaItems.mock.calls[0][0] as MediaItem[];
  expect(items).toEqual([expect.objectContaining({
    mediaId: 'track-1', url: { uri: 'file:///music/test.mp3', headers: song.headers },
    albumTitle: 'Album', artworkUrl: song.artwork, duration: 181.25, extras: { genre: 'Techno' },
  })]);
  native.getQueue.mockReturnValue(items);
  native.getActiveMediaItem.mockReturnValue(items[0]);
  native.getActiveMediaItemIndex.mockReturnValue(0);
  await expect(adapter.default.getQueue()).resolves.toEqual([
    expect.objectContaining({ ...song, url: 'file:///music/test.mp3' }),
  ]);
  await expect(adapter.default.getActiveTrack()).resolves.toEqual(expect.objectContaining({ id: song.id }));
  await expect(adapter.default.getActiveTrackIndex()).resolves.toBe(0);
});

test('normalizes absence and uninitialized progress without inventing an active track', async () => {
  await expect(adapter.default.getActiveTrack()).resolves.toBeUndefined();
  await expect(adapter.default.getActiveTrackIndex()).resolves.toBeUndefined();
  native.getActiveMediaItemIndex.mockReturnValue(-1);
  await expect(adapter.default.getActiveTrackIndex()).resolves.toBeUndefined();
  native.getProgress.mockReturnValue({ position: Number.NaN, duration: -9223372036854776, buffered: -1 });
  await expect(adapter.default.getProgress()).resolves.toEqual({ position: 0, duration: 0, buffered: 0 });
});

test('maps capabilities and repeat mode, preserves two-second native heartbeats', async () => {
  const { Capability, RepeatMode, AppKilledPlaybackBehavior } = adapter;
  await adapter.default.updateOptions({
    android: { appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification },
    capabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SeekTo],
    compactCapabilities: [Capability.Play], progressUpdateEventInterval: 2,
  });
  expect(native.setCommands).toHaveBeenCalledWith({
    capabilities: ['playPause', 'next', 'seek'], handling: 'native',
  });
  await adapter.default.setRepeatMode(RepeatMode.Track);
  expect(native.setRepeatMode).toHaveBeenLastCalledWith('one');
  native.getRepeatMode.mockReturnValue('all');
  await expect(adapter.default.getRepeatMode()).resolves.toBe(RepeatMode.Queue);
  await expect(adapter.default.updateOptions({ progressUpdateEventInterval: 0.1 })).rejects.toThrow('during setup');
});

test('preserves indexed navigation, queue wrap and V4 previous without implicit restart', async () => {
  native.getQueue.mockReturnValue([
    { url: 'content://1' }, { url: 'content://2' }, { url: 'content://3' },
  ]);
  native.getActiveMediaItemIndex.mockReturnValue(2);
  await adapter.default.skipToPrevious();
  expect(native.skipToIndex).toHaveBeenLastCalledWith(1);
  await expect(adapter.default.skipToNext()).rejects.toThrow('out of bounds');
  native.getRepeatMode.mockReturnValue('all');
  await adapter.default.skipToNext();
  expect(native.skipToIndex).toHaveBeenLastCalledWith(0);
  await adapter.default.skip(1, 2.75);
  expect(native.seekTo).toHaveBeenLastCalledWith(2.75);
});

test('validates writes and keeps seek offsets and volume in their original units', async () => {
  await expect(adapter.default.add({ id: 'invalid', url: '' })).rejects.toThrow('URL is required');
  expect(native.addMediaItems).not.toHaveBeenCalled();
  await adapter.default.seekTo(2.75);
  await adapter.default.seekBy(-10);
  await adapter.default.setVolume(0.25);
  expect(native.seekTo).toHaveBeenCalledWith(2.75);
  expect(native.seekBy).toHaveBeenCalledWith(-10);
  expect(native.setVolume).toHaveBeenCalledWith(0.25);
  await expect(adapter.default.seekTo(Number.NaN)).rejects.toThrow('finite');
  await expect(adapter.default.setVolume(2)).rejects.toThrow('between zero and one');
});

test('omits undefined native fields and leaves unspecified metadata intact', async () => {
  await adapter.default.add({ id: 'minimal', url: 'content://minimal', duration: undefined });
  const item = native.addMediaItems.mock.calls[0][0][0];
  expect(Object.keys(item)).toEqual(['mediaId', 'url', 'extras']);
  native.getQueue.mockReturnValue([{ mediaId: 'minimal', url: 'content://minimal' }]);
  await adapter.default.updateMetadataForTrack(0, { title: 'Edited', artist: undefined });
  expect(native.updateMetadata).toHaveBeenCalledWith(0, { title: 'Edited' });
});

test('forwards explicit album and artwork deletions through the real V5 JS bridge', async () => {
  native.getQueue.mockReturnValue([{ mediaId: 'edited', url: 'content://edited' }]);
  await adapter.default.updateMetadataForTrack(0, { album: null, artwork: null });
  expect(native.updateMetadata).toHaveBeenCalledWith(0, { albumTitle: null, artworkUrl: null });
  expect(native.awaitPlaybackCommands).toHaveBeenCalledTimes(1);
});

test('a library metadata refresh follows its song ID when a queued move overtakes the old index', async () => {
  const queue: MediaItem[] = [{ mediaId: 'a', url: 'file:///a.mp3' }, { mediaId: 'b', url: 'file:///b.mp3' }];
  const writtenIds: string[] = [];
  native.getQueue.mockImplementation(() => queue.slice());
  native.moveMediaItem.mockImplementation((from: number, to: number) => {
    queue.splice(to, 0, ...queue.splice(from, 1));
  });
  native.updateMetadata.mockImplementation((index: number) => writtenIds.push(queue[index].mediaId!));
  expect((await adapter.default.getQueue()).map(item => item.id)).toEqual(['a', 'b']);
  void adapter.default.move(0, 1);

  libraryHelpers.updateNativeMetadataForSong('a', { current: [
    { id: 'a', title: 'Edited A', artist: 'A', uri: 'file:///a.mp3' },
    { id: 'b', title: 'B', artist: 'B', uri: 'file:///b.mp3' },
  ] }, { current: [] });
  await flush();
  await flush();

  expect(queue.map(item => item.mediaId)).toEqual(['b', 'a']);
  expect(writtenIds).toEqual(['a']);
  expect(native.updateMetadata).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'Edited A' }));
});

test('a stale metadata index cannot overwrite a replacement queue item with a different song ID', async () => {
  native.getQueue.mockReturnValue([{ mediaId: 'replacement', url: 'file:///replacement.mp3' }]);
  await expect(adapter.default.updateMetadataForTrack(0, { id: 'removed', title: 'Old edited title' }))
    .rejects.toThrow('no longer in the native queue');
  expect(native.updateMetadata).not.toHaveBeenCalled();
});

test('maps real V5 item transitions and removes subscriptions', () => {
  const listener = jest.fn();
  const subscription = adapter.default.addEventListener(adapter.Event.PlaybackActiveTrackChanged, listener);
  ReactNative.DeviceEventEmitter.emit('event.media-item-transition', {
    item: { mediaId: 'active', url: 'content://active', albumTitle: 'Album' }, index: 2, reason: 'seek',
  });
  expect(listener).toHaveBeenCalledWith({
    index: 2, track: expect.objectContaining({ id: 'active', url: 'content://active', album: 'Album' }),
  });
  ReactNative.DeviceEventEmitter.emit('event.media-item-transition', { item: null, index: -1, reason: 'playlistChanged' });
  expect(listener).toHaveBeenLastCalledWith({ index: undefined, track: undefined });
  subscription.remove();
  ReactNative.DeviceEventEmitter.emit('event.media-item-transition', { item: null, index: -1, reason: 'playlistChanged' });
  expect(listener).toHaveBeenCalledTimes(2);
});

const remotePress = (command: string, payload: Record<string, unknown> = {}) => headlessTask({
  event: 'event.remote-command',
  payload: { id: 'press', registration: native.setRemoteHandlers.mock.calls[0][0], command, ...payload },
  rntpTaskToken: 'task-token',
});

test('keeps the actual V5 headless task alive until the remote command promise settles', async () => {
  const completion = deferred();
  const listener = jest.fn(() => completion.promise);
  adapter.default.addEventListener(adapter.Event.RemoteNext, listener);
  const task = remotePress('next');
  await flush();
  expect(listener).toHaveBeenCalledTimes(1);
  expect(native.acceptRemoteCommand).toHaveBeenCalledWith('press', expect.any(String), true);
  expect(native.completeHeadlessTask).not.toHaveBeenCalled();
  completion.resolve();
  await task;
  expect(native.completeHeadlessTask).toHaveBeenCalledWith('task-token');
});

test('lets cold native controls run when the app does not own hydration', async () => {
  const listener = jest.fn();
  adapter.default.setRemoteCommandGuard(() => false);
  adapter.default.addEventListener(adapter.Event.RemotePlay, listener);
  await remotePress('play');
  expect(listener).not.toHaveBeenCalled();
  expect(native.performRemoteDefault).toHaveBeenCalledWith('press');
  expect(native.completeHeadlessTask).toHaveBeenCalledWith('task-token');
});

test('remote seek/jump commands retain seconds and expose listener removal', async () => {
  const seek = jest.fn();
  const jump = jest.fn();
  const seekSubscription = adapter.default.addEventListener(adapter.Event.RemoteSeek, seek);
  const jumpSubscription = adapter.default.addEventListener(adapter.Event.RemoteJumpBackward, jump);
  await remotePress('seek', { position: 2.5 });
  await remotePress('skipBackward', { interval: 10 });
  expect(seek).toHaveBeenCalledWith({ position: 2.5 });
  expect(jump).toHaveBeenCalledWith({ interval: 10 });
  seekSubscription.remove();
  jumpSubscription.remove();
  expect(native.setRemoteHandlers).toHaveBeenLastCalledWith(expect.any(String), []);
});

test('registers UI-free session listeners synchronously before native startup', async () => {
  const ready = deferred();
  native.awaitReady.mockReturnValue(ready.promise);
  adapter.default.registerPlaybackService(() => async () => {
    adapter.default.addEventListener(adapter.Event.RemotePause, () => Promise.resolve());
  });
  expect(native.setRemoteHandlers.mock.invocationCallOrder[0]).toBeLessThan(native.setupPlayer.mock.invocationCallOrder[0]);
  ready.resolve();
  await flush();
  await adapter.default.setupPlayer();
  expect(native.setupPlayer).toHaveBeenCalledTimes(1);
});

test('gets the current native EQ session after startup', async () => {
  await expect(adapter.default.getAudioSessionId()).resolves.toBe(17);
  native.getAudioSessionId.mockResolvedValue(null);
  await expect(adapter.default.getAudioSessionId()).resolves.toBeNull();
});

test('useProgress retains a 500 ms poll, reports seconds, and disposes timers', async () => {
  jest.useFakeTimers();
  const hook = renderHook(() => adapter.useProgress(500));
  await act(async () => { await flush(); });
  expect(hook.result.current).toEqual({ position: 12.5, duration: 120, buffered: 30 });
  expect(native.getProgress).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(499); await flush(); });
  expect(native.getProgress).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(1); await flush(); });
  expect(native.getProgress).toHaveBeenCalledTimes(2);
  hook.unmount();
  jest.advanceTimersByTime(1500);
  await flush();
  expect(native.getProgress).toHaveBeenCalledTimes(2);
  expect(jest.getTimerCount()).toBe(0);
});

test('refreshes buffering play intent from native signals even while audible state remains false', async () => {
  native.getPlaybackState.mockReturnValue('buffering');
  native.getPlayWhenReady.mockReturnValue(true);
  const hook = renderHook(() => ({ state: adapter.usePlaybackState(), intent: adapter.usePlayWhenReady() }));
  await act(async () => { await flush(); });
  expect(hook.result.current).toEqual({ state: { state: adapter.State.Buffering }, intent: true });
  native.getPlayWhenReady.mockReturnValue(false);
  await act(async () => {
    ReactNative.DeviceEventEmitter.emit('event.is-playing-changed', { playing: false });
    await flush();
  });
  expect(hook.result.current.intent).toBe(false);
  hook.unmount();
});

test('preserves pending play intent in ready state without claiming audible output', async () => {
  native.getPlaybackState.mockReturnValue('ready');
  native.getPlayWhenReady.mockReturnValue(true);
  native.isPlaying.mockReturnValue(false);
  await expect(adapter.default.getPlaybackState()).resolves.toEqual({ state: adapter.State.Ready });
  native.isPlaying.mockReturnValue(true);
  await expect(adapter.default.getPlaybackState()).resolves.toEqual({ state: adapter.State.Playing });
  native.isPlaying.mockReturnValue(false);
  native.getPlayWhenReady.mockReturnValue(false);
  await expect(adapter.default.getPlaybackState()).resolves.toEqual({ state: adapter.State.Paused });
});
