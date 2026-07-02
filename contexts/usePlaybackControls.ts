import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
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

const SEEK_STATE_SETTLE_MS = 150;

export const usePlaybackControls = (): PlaybackControls => {
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [volume, setVolumeState] = useState(1);
  const [isSeekPending, setIsSeekPending] = useState(false);
  const playback = usePlaybackState();
  const settleSeekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekPlayingIntentRef = useRef(false);
  const seekRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const rawIsPlaying = playback.state === State.Playing;
  const isBuffering = playback.state === State.Buffering || playback.state === State.Loading;

  if (!isSeekPending) {
    seekPlayingIntentRef.current = rawIsPlaying;
  }

  const shouldPinSeekIntent = isSeekPending && isBuffering;
  const isPlaying = shouldPinSeekIntent ? seekPlayingIntentRef.current : rawIsPlaying;

  useEffect(() => () => {
    isMountedRef.current = false;
    if (settleSeekTimeoutRef.current) {
      clearTimeout(settleSeekTimeoutRef.current);
    }
  }, []);

  const togglePlayPause = useCallback(async () => {
    await toggleTrackPlayerPlayback();
  }, []);

  const stop = useCallback(async () => {
    await TrackPlayer.stop();
  }, []);

  const seekTo = useCallback(async (millis: number) => {
    const seekRequestId = seekRequestIdRef.current + 1;
    seekRequestIdRef.current = seekRequestId;
    seekPlayingIntentRef.current = isPlaying;
    if (settleSeekTimeoutRef.current) {
      clearTimeout(settleSeekTimeoutRef.current);
      settleSeekTimeoutRef.current = null;
    }
    setIsSeekPending(true);
    try {
      await seekToMillis(millis);
    } finally {
      if (!isMountedRef.current || seekRequestId !== seekRequestIdRef.current) return;

      settleSeekTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current || seekRequestId !== seekRequestIdRef.current) return;

        settleSeekTimeoutRef.current = null;
        setIsSeekPending(false);
      }, SEEK_STATE_SETTLE_MS);
    }
  }, [isPlaying]);

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