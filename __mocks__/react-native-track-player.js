/**
 * Mock for react-native-track-player. Provides minimal in-memory queue/state
 * so MusicContext flows can be exercised in unit tests without a native runtime.
 */

const State = {
  None: 'none',
  Ready: 'ready',
  Playing: 'playing',
  Paused: 'paused',
  Stopped: 'stopped',
  Buffering: 'buffering',
  Loading: 'loading',
  Ended: 'ended',
};

const RepeatMode = { Off: 0, Track: 1, Queue: 2 };

const Capability = {
  Play: 'play',
  Pause: 'pause',
  Stop: 'stop',
  SkipToNext: 'skip-next',
  SkipToPrevious: 'skip-prev',
  SeekTo: 'seek',
  JumpForward: 'jf',
  JumpBackward: 'jb',
};

const Event = {
  PlaybackActiveTrackChanged: 'PlaybackActiveTrackChanged',
  PlaybackProgressUpdated: 'PlaybackProgressUpdated',
  RemotePlay: 'RemotePlay',
  RemotePause: 'RemotePause',
  RemoteStop: 'RemoteStop',
  RemoteNext: 'RemoteNext',
  RemotePrevious: 'RemotePrevious',
  RemoteSeek: 'RemoteSeek',
  RemoteJumpForward: 'RemoteJumpForward',
  RemoteJumpBackward: 'RemoteJumpBackward',
};

const AppKilledPlaybackBehavior = {
  ContinuePlayback: 'continue',
  PausePlayback: 'pause',
  StopPlaybackAndRemoveNotification: 'stop-remove',
};

let state = State.Paused;
let playWhenReady = false;
let queue = [];
let currentIdx = -1;
let volume = 1;
let repeatMode = RepeatMode.Off;
let listeners = new Map();

const trigger = (event, payload) => {
  const set = listeners.get(event);
  if (!set) return;
  for (const cb of set) cb(payload);
};

const TrackPlayer = {
  setupPlayer: jest.fn().mockResolvedValue(undefined),
  updateOptions: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn(async () => {
    queue = [];
    currentIdx = -1;
    state = State.None;
    playWhenReady = false;
  }),
  add: jest.fn(async (tracks, insertBeforeIndex) => {
    const additions = Array.isArray(tracks) ? tracks : [tracks];
    if (typeof insertBeforeIndex === 'number') queue.splice(insertBeforeIndex, 0, ...additions);
    else queue = queue.concat(additions);
    if (currentIdx === -1 && queue.length > 0) {
      currentIdx = 0;
      trigger(Event.PlaybackActiveTrackChanged, { track: queue[0] });
    }
  }),
  play: jest.fn(async () => {
    playWhenReady = true;
    state = State.Playing;
  }),
  pause: jest.fn(async () => {
    playWhenReady = false;
    state = State.Paused;
  }),
  stop: jest.fn(async () => {
    playWhenReady = false;
    state = State.Stopped;
  }),
  seekTo: jest.fn().mockResolvedValue(undefined),
  seekBy: jest.fn().mockResolvedValue(undefined),
  setVolume: jest.fn(async v => {
    volume = v;
  }),
  getVolume: jest.fn(async () => volume),
  setRepeatMode: jest.fn(async mode => {
    repeatMode = mode;
  }),
  getRepeatMode: jest.fn(async () => repeatMode),
  skip: jest.fn(async index => {
    if (index < 0 || index >= queue.length) {
      throw new Error('track not found');
    }
    currentIdx = index;
    trigger(Event.PlaybackActiveTrackChanged, { track: queue[currentIdx] });
  }),
  skipToNext: jest.fn(async () => {
    if (currentIdx + 1 < queue.length) {
      currentIdx += 1;
      trigger(Event.PlaybackActiveTrackChanged, { track: queue[currentIdx] });
    } else {
      throw new Error('end of queue');
    }
  }),
  skipToPrevious: jest.fn(async () => {
    if (currentIdx - 1 >= 0) {
      currentIdx -= 1;
      trigger(Event.PlaybackActiveTrackChanged, { track: queue[currentIdx] });
    }
  }),
  getQueue: jest.fn(async () => queue),
  getActiveTrack: jest.fn(async () => queue[currentIdx]),
  getActiveTrackIndex: jest.fn(async () => currentIdx >= 0 ? currentIdx : undefined),
  getProgress: jest.fn(async () => ({ position: 0, duration: 0, buffered: 0 })),
  getPlaybackState: jest.fn(async () => ({ state })),
  getPlayWhenReady: jest.fn(async () => playWhenReady),
  updateMetadataForTrack: jest.fn(async (trackIndex, metadata) => {
    if (typeof trackIndex !== 'number') return;
    if (trackIndex < 0 || trackIndex >= queue.length) return;
    queue[trackIndex] = { ...queue[trackIndex], ...metadata };
  }),
  addEventListener: jest.fn((event, cb) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(cb);
    return {
      remove: () => listeners.get(event)?.delete(cb),
    };
  }),
  registerPlaybackService: jest.fn(),
  // Hooks
  usePlaybackState: jest.fn(() => ({ state })),
  useProgress: jest.fn(() => ({ position: 0, duration: 0, buffered: 0 })),
  // Test helpers
  __reset: () => {
    state = State.Paused;
    playWhenReady = false;
    queue = [];
    currentIdx = -1;
    volume = 1;
    repeatMode = RepeatMode.Off;
    listeners = new Map();
  },
  __getQueue: () => queue,
  __getActiveTrackIndex: () => currentIdx,
  __getState: () => state,
  __getPlayWhenReady: () => playWhenReady,
  __getRepeatMode: () => repeatMode,
  __getListeners: event => Array.from(listeners.get(event) ?? []),
  __trigger: trigger,
  __setState: nextState => {
    state = nextState;
  },
  __setPlayWhenReady: value => {
    playWhenReady = value;
  },
};

module.exports = {
  __esModule: true,
  default: TrackPlayer,
  State,
  RepeatMode,
  Capability,
  Event,
  AppKilledPlaybackBehavior,
  usePlaybackState: TrackPlayer.usePlaybackState,
  useProgress: TrackPlayer.useProgress,
};
