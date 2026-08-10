import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { State, type PanGestureHandlerGestureEvent, type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { shouldCollapseSoundCloudPlayer, shouldCommitSoundCloudSwipe } from '../utils/soundCloudPlayer';

interface TrackSwitchOptions {
  drag: Animated.Value;
  currentSongId?: string;
  panelWidth: number;
  onNext: () => void;
  onPrevious: () => void;
  reduceMotion: boolean;
}

const useTrackSwitchAnimation = ({ drag, currentSongId, panelWidth, onNext, onPrevious,
  reduceMotion }: TrackSwitchOptions) => {
  const switchingRef = useRef(false);
  const songIdRef = useRef(currentSongId);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  songIdRef.current = currentSongId;
  const clearReset = useCallback(() => {
    if (!resetTimerRef.current) return;
    clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
  }, []);
  const animateBack = useCallback(() => {
    clearReset();
    if (reduceMotion) {
      drag.stopAnimation();
      drag.setValue(0);
      switchingRef.current = false;
      return;
    }
    Animated.spring(drag, { toValue: 0, tension: 150, friction: 22, useNativeDriver: true })
      .start(() => { switchingRef.current = false; });
  }, [clearReset, drag, reduceMotion]);
  useLayoutEffect(() => {
    clearReset();
    drag.stopAnimation();
    drag.setValue(0);
    switchingRef.current = false;
  }, [clearReset, currentSongId, drag]);
  useEffect(() => () => {
    clearReset();
    drag.stopAnimation();
  }, [clearReset, drag]);
  const complete = useCallback((direction: 'next' | 'previous') => {
    switchingRef.current = true;
    if (reduceMotion) {
      drag.stopAnimation();
      drag.setValue(0);
      if (direction === 'next') onNext(); else onPrevious();
      switchingRef.current = false;
      return;
    }
    Animated.timing(drag, { toValue: direction === 'next' ? -panelWidth : panelWidth,
      duration: 270, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return animateBack();
      const previousSongId = songIdRef.current;
      if (direction === 'next') onNext(); else onPrevious();
      clearReset();
      resetTimerRef.current = setTimeout(() => {
        resetTimerRef.current = null;
        if (switchingRef.current && songIdRef.current === previousSongId) animateBack();
      }, 500);
    });
  }, [animateBack, clearReset, drag, onNext, onPrevious, panelWidth, reduceMotion]);
  return { switchingRef, animateBack, complete };
};

interface HorizontalMotionOptions extends Omit<TrackSwitchOptions, 'drag'> {
  hasPrevious: boolean;
  hasNext: boolean;
}

export const useHorizontalTrackMotion = ({ currentSongId, panelWidth, onNext, onPrevious,
  hasPrevious, hasNext, reduceMotion }: HorizontalMotionOptions) => {
  const drag = useRef(new Animated.Value(0)).current;
  const switching = useTrackSwitchAnimation({ drag, currentSongId, panelWidth, onNext, onPrevious, reduceMotion });
  const onGestureEvent = useMemo(() => Animated.event<PanGestureHandlerGestureEvent>(
    [{ nativeEvent: { translationX: drag } }], { useNativeDriver: true }), [drag]);
  const onStateChange = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { oldState, state, translationX = 0, translationY = 0, velocityX = 0 } = event.nativeEvent;
    if (oldState === State.ACTIVE) {
      if (switching.switchingRef.current) return;
      const wantsNext = translationX < 0;
      const allowed = wantsNext ? hasNext : hasPrevious;
      if (allowed && shouldCommitSoundCloudSwipe({ translationX, translationY, velocityX, width: panelWidth }))
        switching.complete(wantsNext ? 'next' : 'previous');
      else switching.animateBack();
    } else if (state === State.CANCELLED || state === State.FAILED) switching.animateBack();
  }, [hasNext, hasPrevious, panelWidth, switching]);
  const constrainedDrag = useMemo(() => drag.interpolate({ inputRange: [-panelWidth, 0, panelWidth],
    outputRange: [hasNext ? -panelWidth : -panelWidth * 0.12, 0,
      hasPrevious ? panelWidth : panelWidth * 0.12], extrapolate: 'clamp' }),
  [drag, hasNext, hasPrevious, panelWidth]);
  return { drag, constrainedDrag, onGestureEvent, onStateChange };
};

export const useVerticalPlayerMotion = ({ height, onCollapse, reduceMotion }: {
  height: number;
  onCollapse: () => void;
  reduceMotion: boolean;
}) => {
  const drag = useRef(new Animated.Value(0)).current;
  useEffect(() => () => drag.stopAnimation(), [drag]);
  const animateBack = useCallback(() => {
    if (reduceMotion) {
      drag.stopAnimation();
      drag.setValue(0);
      return;
    }
    Animated.spring(drag, { toValue: 0, tension: 150, friction: 22, useNativeDriver: true }).start();
  }, [drag, reduceMotion]);
  const onGestureEvent = useMemo(() => Animated.event<PanGestureHandlerGestureEvent>(
    [{ nativeEvent: { translationY: drag } }], { useNativeDriver: true }), [drag]);
  const onStateChange = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { oldState, state, translationY = 0, velocityY = 0 } = event.nativeEvent;
    if (oldState === State.ACTIVE && shouldCollapseSoundCloudPlayer({ translationY, velocityY, height })) {
      if (reduceMotion) {
        drag.setValue(0);
        onCollapse();
        return;
      }
      Animated.timing(drag, { toValue: height, duration: 220,
        easing: Easing.out(Easing.cubic), useNativeDriver: true })
        .start(({ finished }) => { if (finished) onCollapse(); });
    } else if (oldState === State.ACTIVE || state === State.CANCELLED || state === State.FAILED) animateBack();
  }, [animateBack, drag, height, onCollapse, reduceMotion]);
  const translateY = useMemo(() => drag.interpolate({ inputRange: [-1, 0, height],
    outputRange: [0, 0, height], extrapolate: 'clamp' }), [drag, height]);
  const scale = useMemo(() => drag.interpolate({ inputRange: [0, height],
    outputRange: [1, 0.94], extrapolate: 'clamp' }), [drag, height]);
  const opacity = useMemo(() => drag.interpolate({ inputRange: [0, height * 0.75],
    outputRange: [1, 0.82], extrapolate: 'clamp' }), [drag, height]);
  return { translateY, scale, opacity, onGestureEvent, onStateChange };
};
