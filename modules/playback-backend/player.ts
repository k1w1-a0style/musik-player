import Player, { PlaybackState as NativeState } from '@rntp/player';
import { acknowledge, mutate, nativePlayer, read } from './native';
import { fromMediaItem, fromNativeRepeatMode, omitUndefined, toCommands, toMediaItem, toNativeRepeatMode, toProgress } from './conversions';
import { AppKilledPlaybackBehavior, State, type PlaybackError, type PlaybackState, type PlayerOptions, type Progress, type RepeatMode, type Track, type UpdateOptions } from './types';

let setupAttempt: Promise<void> | undefined;
let configured = false;
let latestError: PlaybackError | undefined;

export const rememberPlaybackError = (error: PlaybackError): void => { latestError = error; };

const releaseFailedController = (): void => {
  // destroy resets V5's JS setup flag after a failed native connection.
  try { Player.destroy(); }
  catch (error) { console.warn('[PlaybackBackend] Failed controller cleanup', error); }
  configured = false;
};

const initializePlayer = async (): Promise<void> => {
  if (configured) {
    try { await nativePlayer().awaitReady(); return; }
    catch { releaseFailedController(); }
  }
  Player.setupPlayer({
    contentType: 'music', audioMixing: 'exclusive', handleAudioBecomingNoisy: true,
    progressSync: { intervalSeconds: 2 },
    android: { taskRemovedBehavior: 'stop', autoStartJs: true },
  });
  await nativePlayer().awaitReady();
  configured = true;
  latestError = undefined;
};

/** V5 startup is asynchronous on Android. Never trust its default startup getters. */
export const setupPlayer = (_options: PlayerOptions = {}): Promise<void> => {
  if (setupAttempt) return setupAttempt;
  const attempt = initializePlayer();
  setupAttempt = attempt;
  const clearAttempt = () => { if (setupAttempt === attempt) setupAttempt = undefined; };
  void attempt.then(clearAttempt, () => { releaseFailedController(); clearAttempt(); });
  return attempt;
};

const validateOptions = (options: UpdateOptions): void => {
  const removal = options.android?.appKilledPlaybackBehavior;
  if (removal && removal !== AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification) {
    throw new Error('Changing task-removal behavior requires a new playback setup.');
  }
  if (options.progressUpdateEventInterval !== undefined && options.progressUpdateEventInterval !== 2) {
    throw new Error('Native progress events are configured at two seconds during setup.');
  }
};

export const updateOptions = (options: UpdateOptions): Promise<void> => mutate(async () => {
  validateOptions(options);
  await acknowledge(() => Player.setCommands(omitUndefined({
    capabilities: toCommands(options.capabilities ?? []),
    handling: 'native',
    forwardInterval: options.forwardJumpInterval,
    backwardInterval: options.backwardJumpInterval,
  })));
});

export const play = (): Promise<void> => mutate(() => acknowledge(() => Player.play()));
export const pause = (): Promise<void> => mutate(() => acknowledge(() => Player.pause()));
export const stop = (): Promise<void> => mutate(() => acknowledge(() => Player.stop()));

export const reset = (): Promise<void> => mutate(async () => {
  // clear alone retains playWhenReady in Media3; a reset must remove that intent.
  await acknowledge(() => Player.stop());
  await acknowledge(() => Player.clear());
});

const requireFinite = (value: number, name: string): void => {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite.`);
};

export const seekTo = (position: number): Promise<void> => mutate(async () => {
  requireFinite(position, 'Seek position');
  if (position < 0) throw new Error('Seek position cannot be negative.');
  await acknowledge(() => Player.seekTo(position));
});

export const seekBy = (offset: number): Promise<void> => mutate(async () => {
  requireFinite(offset, 'Seek offset');
  await acknowledge(() => Player.seekBy(offset));
});

const validQueueIndex = (index: number, length: number, allowEnd = false): void => {
  if (!Number.isInteger(index) || index < 0 || index >= length + (allowEnd ? 1 : 0)) {
    throw new Error(`Queue index ${index} is out of bounds.`);
  }
};

export const add = (tracks: Track | Track[], insertBeforeIndex = -1): Promise<number | undefined> => mutate(async () => {
  const items = (Array.isArray(tracks) ? tracks : [tracks]).map(toMediaItem);
  if (!items.length) return undefined;
  if (insertBeforeIndex === -1) {
    await acknowledge(() => Player.addMediaItems(items));
    return undefined;
  }
  validQueueIndex(insertBeforeIndex, Player.getQueue().length, true);
  await acknowledge(() => Player.insertMediaItems(insertBeforeIndex, items));
  return insertBeforeIndex;
});

export const skip = (index: number, initialPosition?: number): Promise<void> => mutate(async () => {
  validQueueIndex(index, Player.getQueue().length);
  if (initialPosition !== undefined) requireFinite(initialPosition, 'Initial position');
  await acknowledge(() => Player.skipToIndex(index));
  if (initialPosition !== undefined && initialPosition >= 0) {
    await acknowledge(() => Player.seekTo(initialPosition));
  }
});

const skipAdjacent = (direction: 1 | -1): Promise<void> => mutate(async () => {
  const length = Player.getQueue().length;
  const index = Player.getActiveMediaItemIndex();
  if (index == null || !length) throw new Error('No active track.');
  let target = index + direction;
  if (Player.getRepeatMode() === 'all') target = (target + length) % length;
  validQueueIndex(target, length);
  // Index navigation preserves V4 behavior across platforms (no implicit restart).
  await acknowledge(() => Player.skipToIndex(target));
});

export const skipToNext = (): Promise<void> => skipAdjacent(1);
export const skipToPrevious = (): Promise<void> => skipAdjacent(-1);

export const move = (fromIndex: number, toIndex: number): Promise<void> => mutate(async () => {
  const length = Player.getQueue().length;
  validQueueIndex(fromIndex, length);
  validQueueIndex(toIndex, length);
  await acknowledge(() => Player.moveMediaItem(fromIndex, toIndex));
});

export const updateMetadataForTrack = (index: number, track: Partial<Track>): Promise<void> => mutate(async () => {
  validQueueIndex(index, Player.getQueue().length);
  await acknowledge(() => Player.updateMetadata(index, omitUndefined({
    title: track.title, artist: track.artist, albumTitle: track.album, artworkUrl: track.artwork,
  })));
});

export const setRepeatMode = (mode: RepeatMode): Promise<RepeatMode> => mutate(async () => {
  const nativeMode = toNativeRepeatMode(mode);
  await acknowledge(() => Player.setRepeatMode(nativeMode));
  return mode;
});

export const setVolume = (volume: number): Promise<void> => mutate(async () => {
  requireFinite(volume, 'Volume');
  if (volume < 0 || volume > 1) throw new Error('Volume must be between zero and one.');
  await acknowledge(() => Player.setVolume(volume));
});

export const getQueue = (): Promise<Track[]> => read(() => Player.getQueue().map(fromMediaItem));
export const getActiveTrack = (): Promise<Track | undefined> => read(() => {
  const item = Player.getActiveMediaItem();
  return item ? fromMediaItem(item) : undefined;
});
export const getActiveTrackIndex = (): Promise<number | undefined> => read(() => {
  const index = Player.getActiveMediaItemIndex();
  return index != null && index >= 0 ? index : undefined;
});
export const getProgress = (): Promise<Progress> => read(() => toProgress(Player.getProgress()));
export const getPlayWhenReady = (): Promise<boolean> => read(() => nativePlayer().getPlayWhenReady());
export const getRepeatMode = (): Promise<RepeatMode> => read(() => fromNativeRepeatMode(Player.getRepeatMode()));
export const getAudioSessionId = (): Promise<number | null> => read(() => nativePlayer().getAudioSessionId());

const playbackState = (): PlaybackState => {
  const state = Player.getPlaybackState();
  if (state === NativeState.Error) return { state: State.Error, error: latestError };
  if (state === NativeState.Buffering) return { state: State.Buffering };
  if (state === NativeState.Ended) return { state: State.Ended };
  if (state === NativeState.Idle) {
    if (!Player.getActiveMediaItem()) return { state: State.None };
    return { state: nativePlayer().getPlayWhenReady() ? State.Loading : State.Stopped };
  }
  if (Player.isPlaying()) return { state: State.Playing };
  return { state: nativePlayer().getPlayWhenReady() ? State.Ready : State.Paused };
};
export const getPlaybackState = (): Promise<PlaybackState> => read(playbackState);
