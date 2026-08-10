import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { State, type PanGestureHandlerGestureEvent, type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { PLAYBACK_PROGRESS_UPDATE_INTERVAL_MS } from '../contexts/PlaybackProgressContext';
import { resolveSoundCloudSeekRatio } from '../utils/soundCloudPlayer';

interface PlaybackProgressMotionOptions {
  progressRatio: number;
  safeDuration: number;
  safePosition: number;
  isPlaying: boolean;
}

const usePlaybackProgressMotion = ({ progressRatio, safeDuration, safePosition, isPlaying }: PlaybackProgressMotionOptions) => {
  const progressValue = useRef(new Animated.Value(progressRatio)).current;
  const draggingRef = useRef(false);
  const sync = useCallback(() => {
    if (draggingRef.current) return;
    progressValue.stopAnimation();
    progressValue.setValue(progressRatio);
    if (!isPlaying || safeDuration <= 0 || safePosition >= safeDuration) return;
    const predicted = Math.min(safeDuration, safePosition + PLAYBACK_PROGRESS_UPDATE_INTERVAL_MS);
    Animated.timing(progressValue, { toValue: predicted / safeDuration,
      duration: PLAYBACK_PROGRESS_UPDATE_INTERVAL_MS,
      easing: Easing.linear, useNativeDriver: true }).start();
  }, [isPlaying, progressRatio, progressValue, safeDuration, safePosition]);
  useEffect(() => {
    sync();
    return () => progressValue.stopAnimation();
  }, [progressValue, sync]);
  return { progressValue, draggingRef, sync };
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
  const { progressValue, draggingRef, sync } = usePlaybackProgressMotion({ progressRatio, safeDuration, safePosition, isPlaying });
  const gestureX = useRef(new Animated.Value(0)).current;
  const startRatioRef = useRef(progressRatio);
  const lastPreviewAtRef = useRef(0);
  useEffect(() => {
    gestureX.setValue(0);
    draggingRef.current = false;
  }, [draggingRef, gestureX, waveformKey]);
  const baseTranslate = useMemo(() => progressValue.interpolate({ inputRange: [0, 1],
    outputRange: [viewportCenter, viewportCenter - travelWidth], extrapolate: 'clamp' }),
  [progressValue, travelWidth, viewportCenter]);
  const translateX = useMemo(() => Animated.add(baseTranslate, gestureX), [baseTranslate, gestureX]);
  const preview = useCallback((translationX: number) => {
    if (!onPreviewPosition || safeDuration <= 0) return;
    const now = Date.now();
    if (now - lastPreviewAtRef.current < 50) return;
    lastPreviewAtRef.current = now;
    const ratio = resolveSoundCloudSeekRatio({ startRatio: startRatioRef.current, translationX, travelWidth });
    onPreviewPosition(ratio * safeDuration);
  }, [onPreviewPosition, safeDuration, travelWidth]);
  const onGestureEvent = useMemo(() => Animated.event<PanGestureHandlerGestureEvent['nativeEvent']>(
    [{ nativeEvent: { translationX: gestureX } }], {
      useNativeDriver: true,
      listener: event => preview(event.nativeEvent.translationX ?? 0),
    }), [gestureX, preview]);
  const finish = useCallback((translationX: number, commit: boolean) => {
    const nextRatio = resolveSoundCloudSeekRatio({ startRatio: startRatioRef.current, translationX, travelWidth });
    draggingRef.current = false;
    gestureX.setValue(0);
    progressValue.setValue(commit ? nextRatio : startRatioRef.current);
    if (commit && safeDuration > 0) void onSeek(nextRatio * safeDuration);
    else sync();
    onPreviewPosition?.(null);
  }, [draggingRef, gestureX, onPreviewPosition, onSeek, progressValue, safeDuration, sync, travelWidth]);
  const onStateChange = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { state, oldState, translationX = 0 } = event.nativeEvent;
    if (state === State.BEGAN) {
      draggingRef.current = true;
      lastPreviewAtRef.current = 0;
      onPreviewPosition?.(safePosition);
      gestureX.setValue(0);
      progressValue.stopAnimation(value => { startRatioRef.current = Math.max(0, Math.min(1, value)); });
    } else if (oldState === State.ACTIVE) finish(translationX, true);
    else if (state === State.CANCELLED || state === State.FAILED) finish(translationX, false);
  }, [draggingRef, finish, gestureX, onPreviewPosition, progressValue, safePosition]);
  return { translateX, onGestureEvent, onStateChange };
};
