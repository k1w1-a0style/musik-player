import TrackPlayer, { State } from 'react-native-track-player';
import type { RepeatMode } from '../types/Song';
import { toTrackPlayerRepeatMode } from '../utils/audioPlaybackModes';
import { NativeMutationHydrationStaleError, runExclusiveNativePlaybackControl, type NativeMutationOptions, type NativePlaybackControlContext } from '../utils/nativeQueueMutationLock';
import { requestLatestSeek } from '../utils/seekController';
import { getNativeHydrationGate } from '../utils/nativeHydrationGate';
import type { Song } from '../types/Song';
import { getNativePlaybackIntent, recordNativePlaybackIntent, restoreNativePlaybackIntent } from '../utils/nativePlaybackIntent';
import { enqueuePlaybackIntent } from '../utils/playbackIntentScheduler';
import { requestNativeTrackNavigation } from '../utils/nativeTrackNavigation';

const stableReadyHydrationOptions = () => getNativeHydrationGate().owned
  ? { requireStableReadyHydration: true as const }
  : undefined;

const trackIdentityMutationOptions = () => ({
  ...stableReadyHydrationOptions(),
  invalidatesPendingSeek: true,
});
const runOrderedPlaybackControl = <T>(action: (context: NativePlaybackControlContext) => Promise<T>, options?: NativeMutationOptions): Promise<T> => {
  const gate = getNativeHydrationGate();
  const captured = { ...options, hydrationCapture: options?.requireStableReadyHydration ? gate : undefined };
  return enqueuePlaybackIntent(() => runExclusiveNativePlaybackControl(action, captured));
};

export const clampVolume = (volume: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1));

export const isRepeatMode = (value: unknown): value is RepeatMode =>
  value === 'off' || value === 'all' || value === 'one';

export const normalizeRepeatMode = (value: unknown): RepeatMode =>
  isRepeatMode(value) ? value : 'off';

export const getNextRepeatMode = (repeatMode: RepeatMode | unknown): RepeatMode => {
  const normalizedRepeatMode = normalizeRepeatMode(repeatMode);
  if (normalizedRepeatMode === 'off') return 'all';
  if (normalizedRepeatMode === 'all') return 'one';
  return 'off';
};

let pendingToggles = 0;
export const toggleTrackPlayerPlayback = async (currentlyPlaying?: boolean): Promise<void> => {
  const previousIntent = getNativePlaybackIntent();
  const knownPlaying = pendingToggles > 0 && previousIntent.desired
    ? previousIntent.desired === 'playing' : currentlyPlaying;
  const captured = knownPlaying === undefined ? undefined
    : recordNativePlaybackIntent(knownPlaying ? 'paused' : 'playing');
  pendingToggles += 1;
  try {
  await runOrderedPlaybackControl(async ({ assertHydrationCurrent }) => {
    if (captured) {
      assertHydrationCurrent();
      await restoreNativePlaybackIntent(captured.desired!, captured.revision, () => { assertHydrationCurrent(); return true; });
      return;
    }
    const state = (await TrackPlayer.getPlaybackState()).state;
    assertHydrationCurrent();
    const transient = state === State.Buffering || state === State.Loading || state === State.Ready;
    const wantsPlay = transient ? await TrackPlayer.getPlayWhenReady() : state === State.Playing;
    assertHydrationCurrent();
    if (wantsPlay) {
      recordNativePlaybackIntent('paused');
      await TrackPlayer.pause();
      return;
    }
    recordNativePlaybackIntent('playing');
    await TrackPlayer.play();
  }, stableReadyHydrationOptions());
  } finally { pendingToggles = Math.max(0, pendingToggles - 1); }
};

export const stopTrackPlayerPlayback = async (): Promise<void> => {
  recordNativePlaybackIntent('stopped');
  await runOrderedPlaybackControl(() => TrackPlayer.stop(), trackIdentityMutationOptions());
};

export const seekToMillis = async (millis: number, song?: Song | null): Promise<void> => {
  // Seeking runs on a dedicated lane that coalesces rapid scrub updates and is
  // not serialized behind native queue rebuilds or metadata jobs.
  const result = await requestLatestSeek(millis, undefined, {
    ...stableReadyHydrationOptions(), songIdentity: song ? { id: song.id, uri: song.uri } : undefined,
  });
  if (result.status === 'failed') throw result.error;
  if (result.status === 'stale') throw new Error('Seek target is no longer the active song.');
};

export const skipToNextSafely = async (): Promise<void> => {
  try {
    await requestNativeTrackNavigation(1);
  } catch (error) {
    console.warn('[Playback] skipToNext failed.', error);
  }
};

/**
 * Navigates to the previous queue item without applying the transport button's
 * "restart after three seconds" convention. Page/carousel gestures represent
 * an explicit track navigation intent and must never restart the current item.
 */
export const skipToPreviousTrackSafely = async (): Promise<void> => {
  try {
    await requestNativeTrackNavigation(-1);
  } catch (error) {
    if (error instanceof NativeMutationHydrationStaleError) {
      console.warn('[Playback] Previous-track navigation discarded after hydration changed.', error);
      return;
    }
    console.warn('[Playback] skipToPrevious track navigation failed.', error);
  }
};

export const skipToPreviousOrRestart = async (): Promise<void> => {
  try {
    await requestNativeTrackNavigation(-1, true);
  } catch (error) {
    if (error instanceof NativeMutationHydrationStaleError) {
      console.warn('[Playback] Previous action discarded after hydration changed.', error);
      return;
    }
    console.warn('[Playback] Previous action failed.', error);
  }
};

export const applyRepeatModeToTrackPlayer = async (repeatMode: RepeatMode | unknown): Promise<void> => {
  await TrackPlayer.setRepeatMode(toTrackPlayerRepeatMode(normalizeRepeatMode(repeatMode)));
};

export const applyVolumeToTrackPlayer = async (volume: number): Promise<number> => {
  const clampedVolume = clampVolume(volume);
  await TrackPlayer.setVolume(clampedVolume);
  return clampedVolume;
};
