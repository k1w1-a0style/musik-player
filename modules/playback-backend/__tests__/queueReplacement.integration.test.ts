import type { MediaItem } from '@rntp/player';

/** Real domain + V5 JS; only the Android TurboModule boundary is simulated. */
test.each([false, true])('nonempty replacement avoids empty publication and honors a genuine newer STOP (%s)', async remoteStop => {
  jest.resetModules();
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native');
  const songs = [1, 2, 3, 4].map(id => ({ id: String(id), title: `Song ${id}`, artist: 'A', uri: `file:///${id}.mp3` }));
  let queue: MediaItem[] = songs.slice(0, 2).map(song => ({ mediaId: song.id, url: song.uri, title: song.title }));
  let index = 0;
  let playing = false;
  let state = 'ready';
  let emptyPublications = 0;
  let externalStop: () => void = () => undefined;
  const native = {
    setupPlayer: jest.fn(), destroy: jest.fn(),
    awaitReady: jest.fn().mockResolvedValue(undefined),
    awaitPlaybackCommands: jest.fn().mockResolvedValue(undefined),
    getPlayWhenReady: () => playing, getAudioSessionId: jest.fn().mockResolvedValue(17),
    getPlaybackState: () => state, isPlaying: () => playing,
    getProgress: () => ({ position: 0, duration: 120, buffered: 0 }),
    getQueue: () => queue, getActiveMediaItem: () => queue[index] ?? null,
    getActiveMediaItemIndex: () => queue.length ? index : null,
    getRepeatMode: () => 'off', setCommands: jest.fn(),
    pause: jest.fn(() => { playing = false; }),
    stop: jest.fn(() => { playing = false; state = 'idle'; }),
    play: jest.fn(() => { playing = true; state = 'ready'; }),
    clear: jest.fn(() => { queue = []; emptyPublications += 1; externalStop(); }),
    addMediaItems: jest.fn((items: MediaItem[]) => { queue = [...queue, ...items]; }),
    setMediaItems: jest.fn((items: MediaItem[], startIndex: number) => {
      queue = items; index = startIndex;
      if (remoteStop) externalStop();
    }),
    skipToIndex: jest.fn((value: number) => { index = value; }),
    addListener: jest.fn(), removeListeners: jest.fn(),
  };
  const getEnforcing = ReactNative.TurboModuleRegistry.getEnforcing;
  jest.spyOn(ReactNative.TurboModuleRegistry, 'getEnforcing').mockImplementation(name =>
    name === 'TrackPlayer' ? native as never : getEnforcing(name) as never);
  jest.replaceProperty(ReactNative.Platform, 'OS', 'android');
  jest.doMock('react-native-track-player', () => jest.requireActual('../index'));
  try {
    const adapter = jest.requireActual<typeof import('../index')>('../index');
    const helper = jest.requireActual<typeof import('../../../contexts/playbackQueueActionHelpers')>('../../../contexts/playbackQueueActionHelpers');
    const intent = jest.requireActual<typeof import('../../../utils/nativePlaybackIntent')>('../../../utils/nativePlaybackIntent');
    // Simulate the valid newer SystemUI STOP that an empty notification queue
    // can trigger. The fix must avoid that trigger, not ignore remote STOP.
    externalStop = () => { intent.recordNativePlaybackIntent('stopped'); };
    await adapter.default.setupPlayer();
    const nativeQueueRef = { current: songs.slice(0, 2) };
    await expect(helper.rebuildNativePlaybackQueueUnlocked(songs, nativeQueueRef, undefined,
      { isCurrent: () => true, beginNativeMutation: jest.fn() }, 1)).resolves.toBe(true);
    expect(emptyPublications).toBe(0);
    expect(playing).toBe(!remoteStop);
    expect(native.stop).toHaveBeenCalledTimes(remoteStop ? 1 : 0);
    expect(native.clear).not.toHaveBeenCalled();
    expect(nativeQueueRef.current.map(song => song.id)).toEqual(['1', '2', '3', '4']);
    expect(queue[index]?.mediaId).toBe('2');
  } finally {
    jest.restoreAllMocks();
    jest.dontMock('react-native-track-player');
  }
});
