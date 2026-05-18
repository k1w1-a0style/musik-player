import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import TrackPlayer, { State, usePlaybackState } from 'react-native-track-player';
import type { RepeatMode } from '../types/Song';
import { toTrackPlayerRepeatMode } from '../utils/audioPlaybackModes';

export interface PlaybackControls {
  isPlaying: boolean;
  isBuffering: boolean;
  repeatMode: RepeatMode;
  setRepeatMode: Dispatch<SetStateAction<RepeatMode>>;
  cycleRepeatMode: () => Promise<void>;
  volume: number;
  setVolumeState: Dispatch<SetStateAction<number>>;
  setVolume: (volume: number) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  stop: () => Promise<void>;
  seekTo: (millis: number) => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
}

export const clampVolume = (volume: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1));

export const getNextRepeatMode = (repeatMode: RepeatMode): RepeatMode =>
  repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';

export const usePlaybackControls = (): PlaybackControls => {
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [volume, setVolumeState] = useState(1);
  const playback = usePlaybackState();

  const isPlaying = playback.state === State.Playing;
  const isBuffering = playback.state === State.Buffering || playback.state === State.Loading;

  const togglePlayPause = useCallback(async () => {
    const state = (await TrackPlayer.getPlaybackState()).state;
    if (state === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  }, []);

  const stop = useCallback(async () => {
    await TrackPlayer.stop();
  }, []);

  const seekTo = useCallback(async (millis: number) => {
    await TrackPlayer.seekTo(millis / 1000);
  }, []);

  const next = useCallback(async () => {
    try {
      await TrackPlayer.skipToNext();
    } catch {
      // end of queue
    }
  }, []);

  const previous = useCallback(async () => {
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
  }, []);

  const cycleRepeatMode = useCallback(async () => {
    const nextRepeatMode = getNextRepeatMode(repeatMode);
    setRepeatMode(nextRepeatMode);
    await TrackPlayer.setRepeatMode(toTrackPlayerRepeatMode(nextRepeatMode));
  }, [repeatMode]);

  const setVolume = useCallback(async (nextVolume: number) => {
    const clampedVolume = clampVolume(nextVolume);
    setVolumeState(clampedVolume);
    await TrackPlayer.setVolume(clampedVolume);
  }, []);

  return {
    isPlaying,
    isBuffering,
    repeatMode,
    setRepeatMode,
    cycleRepeatMode,
    volume,
    setVolumeState,
    setVolume,
    togglePlayPause,
    stop,
    seekTo,
    next,
    previous,
  };
};
