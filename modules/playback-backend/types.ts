/** The app's playback contract. Native playback is provided by @rntp/player V5. */
export enum State {
  None = 'none', Ready = 'ready', Playing = 'playing', Paused = 'paused',
  Stopped = 'stopped', Loading = 'loading', Buffering = 'buffering',
  Error = 'error', Ended = 'ended',
}

export enum RepeatMode { Off = 0, Track = 1, Queue = 2 }

export enum Capability {
  Play = 'play', Pause = 'pause', Stop = 'stop', SeekTo = 'seek',
  SkipToNext = 'skip-next', SkipToPrevious = 'skip-prev',
  JumpForward = 'jump-forward', JumpBackward = 'jump-backward',
}

export enum AppKilledPlaybackBehavior {
  ContinuePlayback = 'continue-playback',
  StopPlaybackAndRemoveNotification = 'stop-playback-and-remove-notification',
}

export enum Event {
  PlaybackState = 'playback-state',
  PlaybackError = 'playback-error',
  PlaybackActiveTrackChanged = 'playback-active-track-changed',
  PlaybackPlayWhenReadyChanged = 'playback-play-when-ready-changed',
  PlaybackProgressUpdated = 'playback-progress-updated',
  RemotePlay = 'remote-play', RemotePause = 'remote-pause', RemoteStop = 'remote-stop',
  RemoteNext = 'remote-next', RemotePrevious = 'remote-previous',
  RemoteSeek = 'remote-seek', RemoteJumpForward = 'remote-jump-forward',
  RemoteJumpBackward = 'remote-jump-backward',
}

export interface Track {
  id?: string;
  url: string;
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
  duration?: number;
  isLiveStream?: boolean;
  contentType?: string;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

/** Null clears a display field; undefined leaves a partial update unchanged. */
export interface TrackMetadata {
  id?: string;
  title?: string;
  artist?: string;
  album?: string | null;
  artwork?: string | null;
  [key: string]: unknown;
}

/** Navigation needs identities, not artwork, URLs, headers or arbitrary extras. */
export interface NavigationSnapshot {
  queue: { id?: string; title?: string }[];
  index?: number;
  activeTrackId?: string;
  repeatMode: RepeatMode;
}

/** Positions and durations remain seconds at this boundary, as in V4. */
export interface Progress { position: number; duration: number; buffered: number }
export interface PlaybackError { code: string; message: string }
export interface PlaybackState { state: State; error?: PlaybackError }
export interface PlaybackActiveTrackChangedEvent {
  index?: number;
  track?: Track;
}

export interface PlayerOptions { autoHandleInterruptions?: boolean }
export interface UpdateOptions {
  android?: { appKilledPlaybackBehavior?: AppKilledPlaybackBehavior };
  capabilities?: Capability[];
  compactCapabilities?: Capability[];
  notificationCapabilities?: Capability[];
  progressUpdateEventInterval?: number;
  forwardJumpInterval?: number;
  backwardJumpInterval?: number;
}

export interface EventPayloadByEvent {
  [Event.PlaybackState]: PlaybackState;
  [Event.PlaybackError]: PlaybackError;
  [Event.PlaybackActiveTrackChanged]: PlaybackActiveTrackChangedEvent;
  [Event.PlaybackPlayWhenReadyChanged]: { playWhenReady: boolean };
  [Event.PlaybackProgressUpdated]: { position: number; duration: number; buffered?: number; track?: number };
  [Event.RemotePlay]: undefined;
  [Event.RemotePause]: undefined;
  [Event.RemoteStop]: undefined;
  [Event.RemoteNext]: undefined;
  [Event.RemotePrevious]: undefined;
  [Event.RemoteSeek]: { position: number };
  [Event.RemoteJumpForward]: { interval: number };
  [Event.RemoteJumpBackward]: { interval: number };
}

export type PlayerEventListener<T extends Event> =
  (payload: EventPayloadByEvent[T]) => unknown;
export interface Subscription { remove(): void }
