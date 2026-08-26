import TrackPlayer, { State } from 'react-native-track-player';
import type { RepeatMode } from '../types/Song';
import { toTrackPlayerRepeatMode } from '../utils/audioPlaybackModes';
import { NativeMutationHydrationStaleError, runExclusiveNativePlaybackControl } from '../utils/nativeQueueMutationLock';
import { requestLatestSeek } from '../utils/seekController';
import { getNativeHydrationGate } from '../utils/nativeHydrationGate';

const stableReadyHydrationOptions = () => getNativeHydrationGate().owned
  ? { requireStableReadyHydration: true as const }
  : undefined;

const trackIdentityMutationOptions = () => ({
  ...stableReadyHydrationOptions(),
  invalidatesPendingSeek: true,
});

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

export const toggleTrackPlayerPlayback = async (): Promise<void> => {
  await runExclusiveNativePlaybackControl(async ({ assertHydrationCurrent }) => {
    const state = (await TrackPlayer.getPlaybackState()).state;
    assertHydrationCurrent();
    if (state === State.Playing) {
      await TrackPlayer.pause();
      return;
    }
    await TrackPlayer.play();
  }, stableReadyHydrationOptions());
};

export const stopTrackPlayerPlayback = async (): Promise<void> => {
  await runExclusiveNativePlaybackControl(() => TrackPlayer.stop(), trackIdentityMutationOptions());
};

export const seekToMillis = async (millis: number): Promise<void> => {
  // Seeking runs on a dedicated lane that coalesces rapid scrub updates and is
  // not serialized behind native queue rebuilds or metadata jobs.
  await requestLatestSeek(millis, undefined, stableReadyHydrationOptions());
};

export const skipToNextSafely = async (): Promise<void> => {
  try {
    await runExclusiveNativePlaybackControl(() => TrackPlayer.skipToNext(), trackIdentityMutationOptions());
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
    await runExclusiveNativePlaybackControl(
      () => TrackPlayer.skipToPrevious(),
      trackIdentityMutationOptions(),
    );
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
    await runExclusiveNativePlaybackControl(async ({ assertHydrationCurrent }) => {
      try {
        const { position } = await TrackPlayer.getProgress();
        assertHydrationCurrent();
        if (position > 3) {
          await TrackPlayer.seekTo(0);
          return;
        }
        await TrackPlayer.skipToPrevious();
      } catch (error) {
        if (error instanceof NativeMutationHydrationStaleError) throw error;
        console.warn('[Playback] skipToPrevious failed, falling back to restart.', error);
        assertHydrationCurrent();
        try {
          await TrackPlayer.seekTo(0);
        } catch (seekError) {
          console.warn('[Playback] fallback restart failed.', seekError);
        }
      }
    }, trackIdentityMutationOptions());
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
