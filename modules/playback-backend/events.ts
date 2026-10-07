import Player, { Event as NativeEvent, type RemoteCommand, type RemoteHandlers } from '@rntp/player';
import { fromMediaItem } from './conversions';
import { getPlaybackState, getPlayWhenReady, setupPlayer, rememberPlaybackError } from './player';
import { Event, type EventPayloadByEvent, type PlayerEventListener, type Subscription } from './types';

type RemoteListener = (payload: unknown) => unknown;
const remoteListeners = new Map<Event, Set<RemoteListener>>();
let remoteRegistration: Subscription | undefined;
let ownsRemoteCommands: () => boolean = () => true;

/** The domain owns this decision; this package must stay safe for headless import. */
export const setRemoteCommandGuard = (ownsCommands: () => boolean): void => {
  ownsRemoteCommands = ownsCommands;
};

const dispatchRemote = async (event: Event, command: RemoteCommand, payload?: unknown): Promise<void> => {
  const listeners = [...(remoteListeners.get(event) ?? [])];
  if (!ownsRemoteCommands() || !listeners.length) { command.performDefault(); return; }
  const results = await Promise.allSettled(listeners.map(async listener => listener(payload)));
  const failure = results.find(result => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
};

const handlers = (): RemoteHandlers => ({
  play: command => dispatchRemote(Event.RemotePlay, command),
  pause: command => dispatchRemote(Event.RemotePause, command),
  stop: command => dispatchRemote(Event.RemoteStop, command),
  next: command => dispatchRemote(Event.RemoteNext, command),
  previous: command => dispatchRemote(Event.RemotePrevious, command),
  seek: command => dispatchRemote(Event.RemoteSeek, command, { position: command.position }),
  skipForward: command => dispatchRemote(Event.RemoteJumpForward, command, { interval: command.interval }),
  skipBackward: command => dispatchRemote(Event.RemoteJumpBackward, command, { interval: command.interval }),
});

const REMOTE_EVENTS = new Set<Event>([
  Event.RemotePlay, Event.RemotePause, Event.RemoteStop, Event.RemoteNext,
  Event.RemotePrevious, Event.RemoteSeek, Event.RemoteJumpForward, Event.RemoteJumpBackward,
]);

const addRemoteListener = <T extends Event>(event: T, listener: PlayerEventListener<T>): Subscription => {
  const wrapped: RemoteListener = payload => listener(payload as EventPayloadByEvent[T]);
  const listeners = remoteListeners.get(event) ?? new Set<RemoteListener>();
  listeners.add(wrapped);
  remoteListeners.set(event, listeners);
  // Register actual V5 handlers: legacy handling bypasses JS for system Next/Previous.
  if (!remoteRegistration) remoteRegistration = Player.registerRemoteHandlers(handlers());
  return { remove() {
    listeners.delete(wrapped);
    if (!listeners.size) remoteListeners.delete(event);
    if (!remoteListeners.size) { remoteRegistration?.remove(); remoteRegistration = undefined; }
  } };
};

const subscribeSnapshot = <T>(load: () => Promise<T>, listener: (payload: T) => unknown): Subscription => {
  let active = true;
  const refresh = async () => {
    const snapshot = await load();
    if (active) return listener(snapshot);
  };
  const subscriptions = [
    Player.addEventListener(NativeEvent.PlaybackStateChanged, refresh),
    Player.addEventListener(NativeEvent.IsPlayingChanged, refresh),
    Player.addEventListener(NativeEvent.PlaybackError, error => {
      rememberPlaybackError(error);
      return refresh();
    }),
  ];
  return { remove() { active = false; subscriptions.forEach(subscription => subscription.remove()); } };
};

export function addEventListener<T extends Event>(event: T, listener: PlayerEventListener<T>): Subscription {
  if (REMOTE_EVENTS.has(event)) return addRemoteListener(event, listener);
  const emit = (payload: unknown) => listener(payload as EventPayloadByEvent[T]);
  if (event === Event.PlaybackState) return subscribeSnapshot(getPlaybackState, emit);
  if (event === Event.PlaybackPlayWhenReadyChanged) {
    return subscribeSnapshot(async () => ({ playWhenReady: await getPlayWhenReady() }), emit);
  }
  if (event === Event.PlaybackActiveTrackChanged) {
    return Player.addEventListener(NativeEvent.MediaItemTransition, payload => emit({
      index: payload.item && payload.index >= 0 ? payload.index : undefined,
      track: payload.item ? fromMediaItem(payload.item) : undefined,
    }));
  }
  if (event === Event.PlaybackError) {
    return Player.addEventListener(NativeEvent.PlaybackError, error => {
      rememberPlaybackError(error);
      return emit(error);
    });
  }
  if (event === Event.PlaybackProgressUpdated) {
    // V5 heartbeats are already seconds. This listener's app consumer only needs
    // the heartbeat; preserve its exact position/duration without another poll.
    return Player.addEventListener(NativeEvent.PlaybackProgressUpdated, payload => emit({
      position: payload.position, duration: payload.duration,
    }));
  }
  throw new Error(`Unsupported playback event: ${event}`);
}

export const registerPlaybackService = (factory: () => () => void | Promise<void>): void => {
  Player.registerPlaybackSession(() => {
    // Run synchronously so listeners exist before the native controller connects.
    // Do not import App or any UI module from this session's import graph.
    const service = factory()();
    return Promise.all([service, setupPlayer()]).then(() => undefined);
  });
};
