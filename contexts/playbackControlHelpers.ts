import TrackPlayer, { State } from 'react-native-track-player';
import type { RepeatMode } from '../types/Song';
import { toTrackPlayerRepeatMode } from '../utils/audioPlaybackModes';
import { runExclusiveNativePlaybackControl } from '../utils/nativeQueueMutationLock';
import { requestLatestSeek } from '../utils/seekController';

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

export const normalizeSeekSeconds = (millis: number): number => {
  if (!Number.isFinite(millis) || millis <= 0) return 0;
  return millis / 1000;
};

export const toggleTrackPlayerPlayback = async (): Promise<void> => {
  await runExclusiveNativePlaybackControl(async () => {
    const state = (await TrackPlayer.getPlaybackState()).state;
    if (state === State.Playing) {
      await TrackPlayer.pause();
      return;
    }
    await TrackPlayer.play();
  }, { requireStableReadyHydration: true });
};

export const stopTrackPlayerPlayback = async (): Promise<void> => {
  await runExclusiveNativePlaybackControl(() => TrackPlayer.stop(), { requireStableReadyHydration: true });
};

export const seekToMillis = async (millis: number): Promise<void> => {
  // Seeking runs on a dedicated lane that coalesces rapid scrub updates and is
  // not serialized behind native queue rebuilds or metadata jobs.
  await requestLatestSeek(millis);
};

export const skipToNextSafely = async (): Promise<void> => {
  try {
    await runExclusiveNativePlaybackControl(() => TrackPlayer.skipToNext(), { requireStableReadyHydration: true });
  } catch (error) {
    console.warn('[Playback] skipToNext failed.', error);
  }
};

export const skipToPreviousOrRestart = async (): Promise<void> => {
  try {
    const { position } = await TrackPlayer.getProgress();
    if (position > 3) {
      await runExclusiveNativePlaybackControl(() => TrackPlayer.seekTo(0), { requireStableReadyHydration: true });
      return;
    }
    await runExclusiveNativePlaybackControl(() => TrackPlayer.skipToPrevious(), { requireStableReadyHydration: true });
  } catch (error) {
    console.warn('[Playback] skipToPrevious failed, falling back to restart.', error);
    try {
      await runExclusiveNativePlaybackControl(() => TrackPlayer.seekTo(0), { requireStableReadyHydration: true });
    } catch (seekError) {
      console.warn('[Playback] fallback restart failed.', seekError);
    }
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
