import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { State, type PanGestureHandlerGestureEvent, type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
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
    const predicted = Math.min(safeDuration, safePosition + 650);
    Animated.timing(progressValue, { toValue: predicted / safeDuration, duration: 650,
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
}

export const useSoundCloudWaveformMotion = ({ progressRatio, safeDuration, safePosition, isPlaying,
  travelWidth, viewportCenter, waveformKey, onSeek }: SoundCloudWaveformMotionOptions) => {
  const { progressValue, draggingRef, sync } = usePlaybackProgressMotion({ progressRatio, safeDuration, safePosition, isPlaying });
  const gestureX = useRef(new Animated.Value(0)).current;
  const startRatioRef = useRef(progressRatio);
  useEffect(() => {
    gestureX.setValue(0);
    draggingRef.current = false;
  }, [draggingRef, gestureX, waveformKey]);
  const baseTranslate = useMemo(() => progressValue.interpolate({ inputRange: [0, 1],
    outputRange: [viewportCenter, viewportCenter - travelWidth], extrapolate: 'clamp' }),
  [progressValue, travelWidth, viewportCenter]);
  const translateX = useMemo(() => Animated.add(baseTranslate, gestureX), [baseTranslate, gestureX]);
  const onGestureEvent = useMemo(() => Animated.event<PanGestureHandlerGestureEvent>(
    [{ nativeEvent: { translationX: gestureX } }], { useNativeDriver: true }), [gestureX]);
  const finish = useCallback((translationX: number, commit: boolean) => {
    const nextRatio = resolveSoundCloudSeekRatio({ startRatio: startRatioRef.current, translationX, travelWidth });
    draggingRef.current = false;
    gestureX.setValue(0);
    progressValue.setValue(commit ? nextRatio : startRatioRef.current);
    if (commit && safeDuration > 0) void onSeek(nextRatio * safeDuration);
    else sync();
  }, [draggingRef, gestureX, onSeek, progressValue, safeDuration, sync, travelWidth]);
  const onStateChange = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { state, oldState, translationX = 0 } = event.nativeEvent;
    if (state === State.BEGAN) {
      draggingRef.current = true;
      gestureX.setValue(0);
      progressValue.stopAnimation(value => { startRatioRef.current = Math.max(0, Math.min(1, value)); });
    } else if (oldState === State.ACTIVE) finish(translationX, true);
    else if (state === State.CANCELLED || state === State.FAILED) finish(translationX, false);
  }, [draggingRef, finish, gestureX, progressValue]);
  return { translateX, onGestureEvent, onStateChange };
};
