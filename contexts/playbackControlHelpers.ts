import TrackPlayer, { State } from 'react-native-track-player';
import type { RepeatMode } from '../types/Song';
import { toTrackPlayerRepeatMode } from '../utils/audioPlaybackModes';
import { runExclusiveNativeQueueMutation } from '../utils/nativeQueueMutationLock';

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
  const state = (await TrackPlayer.getPlaybackState()).state;
  if (state === State.Playing) {
    await TrackPlayer.pause();
    return;
  }
  await runExclusiveNativeQueueMutation(() => TrackPlayer.play());
};

export const seekToMillis = async (millis: number): Promise<void> => {
  await runExclusiveNativeQueueMutation(() => TrackPlayer.seekTo(normalizeSeekSeconds(millis)));
};

export const skipToNextSafely = async (): Promise<void> => {
  try {
    await runExclusiveNativeQueueMutation(() => TrackPlayer.skipToNext());
  } catch (error) {
    console.warn('[Playback] skipToNext failed.', error);
  }
};

export const skipToPreviousOrRestart = async (): Promise<void> => {
  try {
    const { position } = await TrackPlayer.getProgress();
    if (position > 3) {
      await runExclusiveNativeQueueMutation(() => TrackPlayer.seekTo(0));
      return;
    }
    await runExclusiveNativeQueueMutation(() => TrackPlayer.skipToPrevious());
  } catch (error) {
    console.warn('[Playback] skipToPrevious failed, falling back to restart.', error);
    try {
      await runExclusiveNativeQueueMutation(() => TrackPlayer.seekTo(0));
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
