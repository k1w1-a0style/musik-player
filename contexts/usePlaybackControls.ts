import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { State, usePlaybackState } from 'react-native-track-player';
import type { RepeatMode } from '../types/Song';
import {
  applyRepeatModeToTrackPlayer,
  getNextRepeatMode,
  seekToMillis,
  skipToNextSafely,
  skipToPreviousOrRestart,
  stopTrackPlayerPlayback,
  toggleTrackPlayerPlayback,
} from './playbackControlHelpers';
import { useSerializedVolumeWriter } from './useSerializedVolumeWriter';

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
  const [repeatMode, setRepeatModeValue] = useState<RepeatMode>('off');
  const [volume, setVolumeValue] = useState(1);
  const [isSeekPending, setIsSeekPending] = useState(false);
  const playback = usePlaybackState();
  const settleSeekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekPlayingIntentRef = useRef(false);
  const seekRequestIdRef = useRef(0);
  const isMountedRef = useRef(false);
  const repeatModeRef = useRef<RepeatMode>('off');
  const repeatWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const { confirmedVolumeRef, setVolume } = useSerializedVolumeWriter(isMountedRef, setVolumeValue);

  const rawIsPlaying = playback.state === State.Playing;
  const isBuffering = playback.state === State.Buffering || playback.state === State.Loading;

  if (!isSeekPending) {
    seekPlayingIntentRef.current = rawIsPlaying;
  }

  const shouldPinSeekIntent = isSeekPending && isBuffering;
  const isPlaying = shouldPinSeekIntent ? seekPlayingIntentRef.current : rawIsPlaying;

  useEffect(() => {
    // React may replay effects in development. Re-arm the lifecycle guard on
    // every setup instead of relying on its initial value.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (settleSeekTimeoutRef.current) {
        clearTimeout(settleSeekTimeoutRef.current);
      }
    };
  }, []);

  const setRepeatMode = useCallback<Dispatch<SetStateAction<RepeatMode>>>((action) => {
    setRepeatModeValue(previous => {
      const next = typeof action === 'function' ? action(previous) : action;
      repeatModeRef.current = next;
      return next;
    });
  }, []);

  const setVolumeState = useCallback<Dispatch<SetStateAction<number>>>((action) => {
    setVolumeValue(previous => {
      const requested = typeof action === 'function' ? action(previous) : action;
      const next = Math.max(0, Math.min(1, Number.isFinite(requested) ? requested : 1));
      confirmedVolumeRef.current = next;
      return next;
    });
  }, [confirmedVolumeRef]);

  const togglePlayPause = useCallback(async () => {
    await toggleTrackPlayerPlayback();
  }, []);

  const stop = useCallback(async () => {
    await stopTrackPlayerPlayback();
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

  const cycleRepeatMode = useCallback((): Promise<void> => {
    // Every tap is intentional, so serialize rather than coalesce. The next
    // mode is calculated when its turn begins, not from a stale render closure.
    const operation = repeatWriteQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const nextRepeatMode = getNextRepeatMode(repeatModeRef.current);
        await applyRepeatModeToTrackPlayer(nextRepeatMode);
        repeatModeRef.current = nextRepeatMode;
        if (isMountedRef.current) setRepeatModeValue(nextRepeatMode);
      });
    repeatWriteQueueRef.current = operation;
    return operation;
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
