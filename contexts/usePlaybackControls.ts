import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import TrackPlayer, { State, usePlaybackState } from 'react-native-track-player';
import type { RepeatMode } from '../types/Song';
import {
  applyRepeatModeToTrackPlayer,
  applyVolumeToTrackPlayer,
  getNextRepeatMode,
  seekToMillis,
  skipToNextSafely,
  skipToPreviousOrRestart,
  toggleTrackPlayerPlayback,
} from './playbackControlHelpers';

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

export { clampVolume, getNextRepeatMode } from './playbackControlHelpers';

export const usePlaybackControls = (): PlaybackControls => {
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [volume, setVolumeState] = useState(1);
  const playback = usePlaybackState();

  const isPlaying = playback.state === State.Playing;
  const isBuffering = playback.state === State.Buffering || playback.state === State.Loading;

  const togglePlayPause = useCallback(async () => {
    await toggleTrackPlayerPlayback();
  }, []);

  const stop = useCallback(async () => {
    await TrackPlayer.stop();
  }, []);

  const seekTo = useCallback(async (millis: number) => {
    await seekToMillis(millis);
  }, []);

  const next = useCallback(async () => {
    await skipToNextSafely();
  }, []);

  const previous = useCallback(async () => {
    await skipToPreviousOrRestart();
  }, []);

  const cycleRepeatMode = useCallback(async () => {
    const nextRepeatMode = getNextRepeatMode(repeatMode);
    await applyRepeatModeToTrackPlayer(nextRepeatMode);
    setRepeatMode(nextRepeatMode);
  }, [repeatMode]);

  const setVolume = useCallback(async (nextVolume: number) => {
    const clampedVolume = await applyVolumeToTrackPlayer(nextVolume);
    setVolumeState(clampedVolume);
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