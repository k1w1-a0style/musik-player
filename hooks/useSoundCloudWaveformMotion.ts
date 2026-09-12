import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { State, type PanGestureHandlerGestureEvent, type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { PLAYBACK_PROGRESS_UPDATE_INTERVAL_MS } from '../contexts/PlaybackProgressContext';
import { resolveSoundCloudSeekRatio } from '../utils/soundCloudPlayer';

const LIVE_PREVIEW_THROTTLE_MS = 90;

interface PlaybackProgressMotionOptions {
  progressRatio: number;
  safeDuration: number;
  safePosition: number;
  isPlaying: boolean;
  onPreviewPosition?: (position: number | null) => void;
}

const usePlaybackProgressMotion = ({ progressRatio, safeDuration, safePosition, isPlaying, onPreviewPosition }: PlaybackProgressMotionOptions) => {
  const progressValue = useRef(new Animated.Value(progressRatio)).current;
  const draggingRef = useRef(false);
  const heldSeek = useRef<{ position: number; expires: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseHold = useCallback(() => {
    heldSeek.current = null;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    onPreviewPosition?.(null);
  }, [onPreviewPosition]);
  const sync = useCallback(() => {
    if (draggingRef.current) return;
    const held = heldSeek.current;
    if (held && Math.abs(safePosition - held.position) > 750 && Date.now() < held.expires) return;
    if (held) releaseHold();
    progressValue.stopAnimation();
    progressValue.setValue(progressRatio);
    if (!isPlaying || safeDuration <= 0 || safePosition >= safeDuration) return;
    const predicted = Math.min(safeDuration, safePosition + PLAYBACK_PROGRESS_UPDATE_INTERVAL_MS);
    Animated.timing(progressValue, { toValue: predicted / safeDuration,
      duration: PLAYBACK_PROGRESS_UPDATE_INTERVAL_MS,
      easing: Easing.linear, useNativeDriver: true }).start();
  }, [isPlaying, progressRatio, progressValue, releaseHold, safeDuration, safePosition]);
  useEffect(() => {
    sync();
    return () => progressValue.stopAnimation();
  }, [progressValue, sync]);
  const latestSync = useRef(sync);
  latestSync.current = sync;
  const holdAt = useCallback((ratio: number) => {
    releaseHold();
    heldSeek.current = { position: ratio * safeDuration, expires: Date.now() + 2500 };
    progressValue.setValue(ratio);
    onPreviewPosition?.(ratio * safeDuration);
    holdTimer.current = setTimeout(() => { releaseHold(); latestSync.current(); }, 2500);
  }, [onPreviewPosition, progressValue, releaseHold, safeDuration]);
  useEffect(() => () => { if (holdTimer.current) clearTimeout(holdTimer.current); }, []);
  return { progressValue, draggingRef, sync, holdAt, releaseHold };
};

interface SoundCloudWaveformMotionOptions extends PlaybackProgressMotionOptions {
  travelWidth: number;
  viewportCenter: number;
  waveformKey: string;
  onSeek: (position: number) => void | Promise<void>;
  onPreviewPosition?: (position: number | null) => void;
}

export const useSoundCloudWaveformMotion = ({ progressRatio, safeDuration, safePosition, isPlaying,
  travelWidth, viewportCenter, waveformKey, onSeek, onPreviewPosition }: SoundCloudWaveformMotionOptions) => {
  const { progressValue, draggingRef, sync, holdAt, releaseHold } = usePlaybackProgressMotion({
    progressRatio, safeDuration, safePosition, isPlaying, onPreviewPosition });
  const gestureX = useRef(new Animated.Value(0)).current;
  const startRatioRef = useRef(progressRatio);
  const lastPreviewAtRef = useRef(0);
  useEffect(() => {
    gestureX.setValue(0);
    draggingRef.current = false;
    releaseHold();
  }, [draggingRef, gestureX, releaseHold, waveformKey]);
  const baseTranslate = useMemo(() => progressValue.interpolate({ inputRange: [0, 1],
    outputRange: [viewportCenter, viewportCenter - travelWidth], extrapolate: 'clamp' }),
  [progressValue, travelWidth, viewportCenter]);
  const translateX = useMemo(() => Animated.add(baseTranslate, gestureX), [baseTranslate, gestureX]);
  const preview = useCallback((translationX: number) => {
    if (!onPreviewPosition || safeDuration <= 0) return;
    const now = Date.now();
    if (now - lastPreviewAtRef.current < LIVE_PREVIEW_THROTTLE_MS) return;
    lastPreviewAtRef.current = now;
    const ratio = resolveSoundCloudSeekRatio({ startRatio: startRatioRef.current, translationX, travelWidth });
    onPreviewPosition(ratio * safeDuration);
  }, [onPreviewPosition, safeDuration, travelWidth]);
  const onGestureEvent = useMemo(() => Animated.event<PanGestureHandlerGestureEvent['nativeEvent']>(
    [{ nativeEvent: { translationX: gestureX } }],
    {
      useNativeDriver: true,
      // The transform stays on the UI thread. JS only receives a throttled time
      // label update, so a busy render cannot make the waveform lag behind the finger.
      listener: (event: PanGestureHandlerGestureEvent) => {
        preview(event.nativeEvent.translationX ?? 0);
      },
    },
  ), [gestureX, preview]);
  const finish = useCallback((translationX: number, commit: boolean) => {
    if (!draggingRef.current) return;
    const nextRatio = resolveSoundCloudSeekRatio({ startRatio: startRatioRef.current, translationX, travelWidth });
    draggingRef.current = false;
    gestureX.setValue(0);
    progressValue.setValue(commit ? nextRatio : startRatioRef.current);
    if (commit && safeDuration > 0) {
      // Keep the released position until the native progress poll confirms it.
      // Otherwise the next stale poll visibly snaps the strip back after seek.
      holdAt(nextRatio);
      void Promise.resolve().then(() => onSeek(nextRatio * safeDuration)).catch(error => {
        console.warn('[WaveformSeek] Seek failed.', error);
      });
    } else { releaseHold(); sync(); }
  }, [draggingRef, gestureX, holdAt, onSeek, progressValue, releaseHold, safeDuration, sync, travelWidth]);
  const onStateChange = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { state, oldState, translationX = 0 } = event.nativeEvent;
    if (state === State.BEGAN) {
      releaseHold();
      draggingRef.current = true;
      lastPreviewAtRef.current = 0;
      onPreviewPosition?.(safePosition);
      gestureX.setValue(0);
      progressValue.stopAnimation(value => { startRatioRef.current = Math.max(0, Math.min(1, value)); });
    } else if (state === State.CANCELLED || state === State.FAILED) finish(translationX, false);
    else if (state === State.END && oldState === State.ACTIVE) finish(translationX, true);
  }, [draggingRef, finish, gestureX, onPreviewPosition, progressValue, releaseHold, safePosition]);
  return { translateX, onGestureEvent, onStateChange };
};
