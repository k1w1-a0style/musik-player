import TrackPlayer, { State } from 'react-native-track-player';
import type { RepeatMode } from '../types/Song';
import { toTrackPlayerRepeatMode } from '../utils/audioPlaybackModes';

export const clampVolume = (volume: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1));

export const getNextRepeatMode = (repeatMode: RepeatMode): RepeatMode =>
  repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';

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
  await TrackPlayer.play();
};

export const seekToMillis = async (millis: number): Promise<void> => {
  await TrackPlayer.seekTo(normalizeSeekSeconds(millis));
};

export const skipToNextSafely = async (): Promise<void> => {
  try {
    await TrackPlayer.skipToNext();
  } catch {
    // end of queue
  }
};

export const skipToPreviousOrRestart = async (): Promise<void> => {
  try {
    const { position } = await TrackPlayer.getProgress();
    if (position > 3) {
      await TrackPlayer.seekTo(0);
      return;
    }
    await TrackPlayer.skipToPrevious();
  } catch {
    try {
      await TrackPlayer.seekTo(0);
    } catch {
      // at start
    }
  }
};

export const applyRepeatModeToTrackPlayer = async (repeatMode: RepeatMode): Promise<void> => {
  await TrackPlayer.setRepeatMode(toTrackPlayerRepeatMode(repeatMode));
};

export const applyVolumeToTrackPlayer = async (volume: number): Promise<number> => {
  const clampedVolume = clampVolume(volume);
  await TrackPlayer.setVolume(clampedVolume);
  return clampedVolume;
};