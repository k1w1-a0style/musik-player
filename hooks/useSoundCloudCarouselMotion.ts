import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { State, type PanGestureHandlerGestureEvent, type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { shouldCollapseSoundCloudPlayer, shouldCommitSoundCloudSwipe,
  shouldOpenSoundCloudQueue } from '../utils/soundCloudPlayer';

interface TrackSwitchOptions {
  drag: Animated.Value;
  currentSongId?: string;
  panelWidth: number;
  onNext: () => void | Promise<void>;
  onPrevious: () => void | Promise<void>;
  reduceMotion: boolean;
  dispatchBeforeAnimation?: boolean;
  onTransitionStart?: () => void;
  onTransitionEnd?: () => void;
}

const TRACK_SWITCH_CONFIRMATION_GRACE_MS = 1_500;
const TRACK_SWITCH_ACTION_TIMEOUT_MS = 8_000;

const useTrackTransitionState = ({ drag, currentSongId, reduceMotion,
  dispatchBeforeAnimation = false, onTransitionEnd }: Pick<TrackSwitchOptions, 'drag' | 'currentSongId'
    | 'reduceMotion' | 'dispatchBeforeAnimation' | 'onTransitionEnd'>) => {
  const switchingRef = useRef(false);
  const songIdRef = useRef(currentSongId);
  const originSongIdRef = useRef(currentSongId);
  const animationFinishedRef = useRef(false);
  const transitionStartedRef = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  songIdRef.current = currentSongId;
  const clearReset = useCallback(() => {
    if (!resetTimerRef.current) return;
    clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
  }, []);
  const endTransition = useCallback(() => {
    if (!transitionStartedRef.current) return;
    transitionStartedRef.current = false;
    onTransitionEnd?.();
  }, [onTransitionEnd]);
  const resetToCurrentTrack = useCallback(() => {
    clearReset();
    drag.stopAnimation();
    drag.setValue(0);
    animationFinishedRef.current = false;
    switchingRef.current = false;
    endTransition();
  }, [clearReset, drag, endTransition]);
  const animateBack = useCallback(() => {
    clearReset();
    animationFinishedRef.current = false;
    if (reduceMotion) {
      drag.stopAnimation();
      drag.setValue(0);
      switchingRef.current = false;
      endTransition();
      return;
    }
    Animated.spring(drag, { toValue: 0, tension: 150, friction: 22, useNativeDriver: true })
      .start(() => {
        switchingRef.current = false;
        endTransition();
      });
  }, [clearReset, drag, endTransition, reduceMotion]);
  useLayoutEffect(() => {
    if (dispatchBeforeAnimation && switchingRef.current) {
      if (currentSongId !== originSongIdRef.current && animationFinishedRef.current)
        resetToCurrentTrack();
      return;
    }
    clearReset();
    drag.stopAnimation();
    drag.setValue(0);
    animationFinishedRef.current = false;
    switchingRef.current = false;
    endTransition();
  }, [clearReset, currentSongId, dispatchBeforeAnimation, drag, endTransition, resetToCurrentTrack]);
  useEffect(() => () => {
    clearReset();
    drag.stopAnimation();
  }, [clearReset, drag]);
  return { switchingRef, songIdRef, originSongIdRef, animationFinishedRef,
    transitionStartedRef, resetTimerRef, clearReset, resetToCurrentTrack, animateBack };
};

const useTrackSwitchAnimation = ({ drag, currentSongId, panelWidth, onNext, onPrevious,
  reduceMotion, dispatchBeforeAnimation = false, onTransitionStart, onTransitionEnd }: TrackSwitchOptions) => {
  const transition = useTrackTransitionState({ drag, currentSongId, reduceMotion,
    dispatchBeforeAnimation, onTransitionEnd });
  const { switchingRef, songIdRef, originSongIdRef, animationFinishedRef,
    transitionStartedRef, resetTimerRef, clearReset, resetToCurrentTrack, animateBack } = transition;
  const complete = useCallback((direction: 'next' | 'previous') => {
    switchingRef.current = true;
    originSongIdRef.current = songIdRef.current;
    animationFinishedRef.current = false;
    const invokeAction = (): void | Promise<void> => direction === 'next' ? onNext() : onPrevious();
    if (reduceMotion) {
      drag.stopAnimation();
      drag.setValue(0);
      void invokeAction();
      switchingRef.current = false;
      return;
    }
    let actionSettled = false;
    let animationSettled = false;
    const scheduleConfirmationFallback = () => {
      if (!actionSettled || !animationSettled || !switchingRef.current) return;
      if (songIdRef.current !== originSongIdRef.current) {
        resetToCurrentTrack();
        return;
      }
      clearReset();
      resetTimerRef.current = setTimeout(() => {
        resetTimerRef.current = null;
        if (switchingRef.current && songIdRef.current === originSongIdRef.current) animateBack();
      }, TRACK_SWITCH_CONFIRMATION_GRACE_MS);
    };
    const scheduleActionWatchdog = () => {
      if (actionSettled || !animationSettled || !switchingRef.current) return;
      clearReset();
      resetTimerRef.current = setTimeout(() => {
        resetTimerRef.current = null;
        if (switchingRef.current && songIdRef.current === originSongIdRef.current) animateBack();
      }, TRACK_SWITCH_ACTION_TIMEOUT_MS);
    };
    const observeAction = (result: void | Promise<void>) => {
      void Promise.resolve(result)
        .catch(() => undefined)
        .finally(() => {
          actionSettled = true;
          scheduleConfirmationFallback();
        });
    };
    // Give native playback the full page-transition window to prepare the next
    // track. The caller keeps the visible page data frozen until both sides
    // have settled, so an early active-track event cannot replace it mid-swipe.
    if (dispatchBeforeAnimation) {
      transitionStartedRef.current = true;
      onTransitionStart?.();
      observeAction(invokeAction());
    }
    Animated.timing(drag, { toValue: direction === 'next' ? -panelWidth : panelWidth,
      duration: 270, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return animateBack();
      animationFinishedRef.current = true;
      animationSettled = true;
      if (dispatchBeforeAnimation) {
        if (songIdRef.current !== originSongIdRef.current) {
          resetToCurrentTrack();
          return;
        }
        if (actionSettled) scheduleConfirmationFallback();
        else scheduleActionWatchdog();
        return;
      }
      observeAction(invokeAction());
      scheduleActionWatchdog();
    });
  }, [animateBack, animationFinishedRef, clearReset, dispatchBeforeAnimation, drag,
    onNext, onPrevious, onTransitionStart, originSongIdRef, panelWidth, reduceMotion,
    resetTimerRef, resetToCurrentTrack, songIdRef, switchingRef, transitionStartedRef]);
  return { switchingRef, animateBack, complete };
};

interface HorizontalMotionOptions extends Omit<TrackSwitchOptions, 'drag'> {
  hasPrevious: boolean;
  hasNext: boolean;
}

export const useHorizontalTrackMotion = ({ currentSongId, panelWidth, onNext, onPrevious,
  hasPrevious, hasNext, reduceMotion, dispatchBeforeAnimation, onTransitionStart,
  onTransitionEnd }: HorizontalMotionOptions) => {
  const drag = useRef(new Animated.Value(0)).current;
  const switching = useTrackSwitchAnimation({ drag, currentSongId, panelWidth, onNext, onPrevious,
    reduceMotion, dispatchBeforeAnimation, onTransitionStart, onTransitionEnd });
  const onGestureEvent = useCallback((event: PanGestureHandlerGestureEvent) => {
    drag.setValue(event.nativeEvent.translationX ?? 0);
  }, [drag]);
  const onStateChange = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { oldState, state, translationX = 0, translationY = 0, velocityX = 0 } = event.nativeEvent;
    if (state === State.CANCELLED || state === State.FAILED) {
      switching.animateBack();
    } else if (state === State.END && oldState === State.ACTIVE) {
      if (switching.switchingRef.current) return;
      const wantsNext = translationX < 0;
      const allowed = wantsNext ? hasNext : hasPrevious;
      if (allowed && shouldCommitSoundCloudSwipe({ translationX, translationY, velocityX, width: panelWidth }))
        switching.complete(wantsNext ? 'next' : 'previous');
      else switching.animateBack();
    }
  }, [hasNext, hasPrevious, panelWidth, switching]);
  const constrainedDrag = useMemo(() => drag.interpolate({ inputRange: [-panelWidth, 0, panelWidth],
    outputRange: [hasNext ? -panelWidth : -panelWidth * 0.12, 0,
      hasPrevious ? panelWidth : panelWidth * 0.12], extrapolate: 'clamp' }),
  [drag, hasNext, hasPrevious, panelWidth]);
  return { drag, constrainedDrag, onGestureEvent, onStateChange };
};

export const useVerticalPlayerMotion = ({ height, onCollapse, onOpenQueue, reduceMotion }: {
  height: number;
  onCollapse: () => void;
  onOpenQueue: () => void;
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
  const onGestureEvent = useCallback((event: PanGestureHandlerGestureEvent) => {
    drag.setValue(event.nativeEvent.translationY ?? 0);
  }, [drag]);
  const onStateChange = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { oldState, state, translationX = 0, translationY = 0, velocityY = 0 } = event.nativeEvent;
    if (state === State.CANCELLED || state === State.FAILED) {
      animateBack();
    } else if (state === State.END && oldState === State.ACTIVE
      && shouldCollapseSoundCloudPlayer({ translationY, velocityY, height })) {
      if (reduceMotion) {
        drag.setValue(0);
        onCollapse();
        return;
      }
      Animated.timing(drag, { toValue: height, duration: 220,
        easing: Easing.out(Easing.cubic), useNativeDriver: true })
        .start(({ finished }) => { if (finished) onCollapse(); });
    } else if (state === State.END && oldState === State.ACTIVE && shouldOpenSoundCloudQueue({
      translationX, translationY, velocityY, height,
    })) {
      drag.stopAnimation();
      drag.setValue(0);
      onOpenQueue();
    } else if (state === State.END && oldState === State.ACTIVE) animateBack();
  }, [animateBack, drag, height, onCollapse, onOpenQueue, reduceMotion]);
  const translateY = useMemo(() => drag.interpolate({ inputRange: [-1, 0, height],
    outputRange: [0, 0, height], extrapolate: 'clamp' }), [drag, height]);
  const scale = useMemo(() => drag.interpolate({ inputRange: [0, height],
    outputRange: [1, 0.94], extrapolate: 'clamp' }), [drag, height]);
  const opacity = useMemo(() => drag.interpolate({ inputRange: [0, height * 0.75],
    outputRange: [1, 0.82], extrapolate: 'clamp' }), [drag, height]);
  return { translateY, scale, opacity, onGestureEvent, onStateChange };
};
