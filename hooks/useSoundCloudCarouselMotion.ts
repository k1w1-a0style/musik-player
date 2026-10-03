import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  transitionDurationMs?: number;
  dispatchBeforeAnimation?: boolean;
  onTransitionStart?: () => void;
  onTransitionEnd?: () => void;
}

const TRACK_SWITCH_CONFIRMATION_GRACE_MS = 1_500;
const TRACK_SWITCH_ACTION_TIMEOUT_MS = 8_000;

const useTrackTransitionLifetime = (drag: Animated.Value) => {
  const generationRef = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearReset = useCallback(() => {
    if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
  }, []);
  useEffect(() => () => {
    generationRef.current += 1;
    clearReset();
    drag.stopAnimation();
  }, [clearReset, drag]);
  return { generationRef, resetTimerRef, clearReset };
};

const useTrackTransitionState = ({ drag, currentSongId, reduceMotion,
  onTransitionEnd }: Pick<TrackSwitchOptions, 'drag' | 'currentSongId'
    | 'reduceMotion' | 'dispatchBeforeAnimation' | 'onTransitionEnd'>) => {
  const switchingRef = useRef(false);
  const { generationRef, resetTimerRef, clearReset } = useTrackTransitionLifetime(drag);
  const songIdRef = useRef(currentSongId);
  const originSongIdRef = useRef(currentSongId);
  const animationFinishedRef = useRef(false);
  const transitionStartedRef = useRef(false);
  const pageOffsetRef = useRef(0);
  const targetDragRef = useRef(0);
  const [pageOffset, setPageOffset] = useState(0);
  songIdRef.current = currentSongId;
  const endTransition = useCallback(() => {
    if (!transitionStartedRef.current) return;
    transitionStartedRef.current = false;
    onTransitionEnd?.();
  }, [onTransitionEnd]);
  const centerTrack = useCallback(() => {
    generationRef.current += 1;
    drag.setValue(-pageOffsetRef.current);
    animationFinishedRef.current = false;
    switchingRef.current = false;
  }, [drag, generationRef]);
  const resetToCurrentTrack = useCallback(() => {
    if (!switchingRef.current) return;
    generationRef.current += 1;
    clearReset();
    drag.stopAnimation();
    // Native Animated writes bypass React's UI mounting batch. Even a layout
    // effect can reset the transform before the reordered image views arrive.
    // Keep the native endpoint and commit its compensating layout offset in
    // the SAME React update that releases/reorders the already-loaded pages.
    pageOffsetRef.current = -targetDragRef.current;
    setPageOffset(pageOffsetRef.current);
    animationFinishedRef.current = false;
    switchingRef.current = false;
    endTransition();
  }, [clearReset, drag, endTransition, generationRef]);
  const animateBack = useCallback(() => {
    const generation = ++generationRef.current;
    clearReset();
    animationFinishedRef.current = false;
    if (reduceMotion) {
      drag.stopAnimation();
      drag.setValue(-pageOffsetRef.current);
      switchingRef.current = false;
      endTransition();
      return;
    }
    Animated.spring(drag, { toValue: -pageOffsetRef.current, tension: 150, friction: 22, useNativeDriver: true })
      .start(({ finished }) => {
        if (!finished || generation !== generationRef.current) return;
        switchingRef.current = false;
        endTransition();
      });
  }, [clearReset, drag, endTransition, generationRef, reduceMotion]);
  useLayoutEffect(() => {
    if (switchingRef.current) {
      if (currentSongId !== originSongIdRef.current && animationFinishedRef.current)
        resetToCurrentTrack();
      return;
    }
    clearReset();
    generationRef.current += 1;
    drag.stopAnimation();
    centerTrack();
    endTransition();
  }, [centerTrack, clearReset, currentSongId, drag, endTransition, generationRef, resetToCurrentTrack]);
  return { switchingRef, songIdRef, originSongIdRef, animationFinishedRef,
    transitionStartedRef, generationRef, resetTimerRef, clearReset, resetToCurrentTrack, animateBack,
    pageOffset, pageOffsetRef, targetDragRef };
};

const createTrackSwitchObserver = (transition: ReturnType<typeof useTrackTransitionState>, generation: number) => {
  const { switchingRef, songIdRef, originSongIdRef, animationFinishedRef,
    generationRef, resetTimerRef, clearReset, resetToCurrentTrack, animateBack } = transition;
  let actionSettled = false;
  const scheduleFallback = () => {
    if (generation !== generationRef.current || !animationFinishedRef.current || !switchingRef.current) return;
    if (songIdRef.current !== originSongIdRef.current) return resetToCurrentTrack();
    clearReset();
    resetTimerRef.current = setTimeout(() => {
      if (generation !== generationRef.current) return;
      resetTimerRef.current = null;
      if (switchingRef.current && songIdRef.current === originSongIdRef.current) animateBack();
    }, actionSettled ? TRACK_SWITCH_CONFIRMATION_GRACE_MS : TRACK_SWITCH_ACTION_TIMEOUT_MS);
  };
  const observeAction = (result: void | Promise<void>) => {
    void Promise.resolve(result).catch(() => undefined).finally(() => {
      if (generation !== generationRef.current) return;
      actionSettled = true;
      scheduleFallback();
    });
  };
  return { observeAction, scheduleFallback };
};

const useTrackSwitchAnimation = ({ drag, currentSongId, panelWidth, onNext, onPrevious,
  reduceMotion, transitionDurationMs = 270, dispatchBeforeAnimation = false,
  onTransitionStart, onTransitionEnd }: TrackSwitchOptions) => {
  const transition = useTrackTransitionState({ drag, currentSongId, reduceMotion,
    dispatchBeforeAnimation, onTransitionEnd });
  const complete = useCallback((direction: 'next' | 'previous') => {
    const { switchingRef, songIdRef, originSongIdRef, animationFinishedRef,
      transitionStartedRef, generationRef, animateBack } = transition;
    // Late playback promises and cancelled native animation callbacks belong
    // only to the transition that created them, never to a subsequent swipe.
    const generation = ++generationRef.current;
    switchingRef.current = true;
    originSongIdRef.current = songIdRef.current;
    animationFinishedRef.current = false;
    const invokeAction = (): Promise<void> => {
      try { return Promise.resolve(direction === 'next' ? onNext() : onPrevious()); }
      catch (error) { return Promise.reject(error); }
    };
    transition.targetDragRef.current = (direction === 'next' ? -panelWidth : panelWidth) - transition.pageOffsetRef.current;
    if (reduceMotion) {
      drag.stopAnimation();
      drag.setValue(-transition.pageOffsetRef.current);
      void invokeAction().catch(() => undefined);
      switchingRef.current = false;
      return;
    }
    const { observeAction, scheduleFallback } = createTrackSwitchObserver(transition, generation);
    // Give native playback the full page-transition window to prepare the next
    // track. The caller keeps the visible page data frozen until both sides
    // have settled, so an early active-track event cannot replace it mid-swipe.
    if (dispatchBeforeAnimation) {
      transitionStartedRef.current = true;
      onTransitionStart?.();
      observeAction(invokeAction());
    }
    Animated.timing(drag, { toValue: transition.targetDragRef.current,
      duration: transitionDurationMs, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (generation !== generationRef.current) return;
      if (!finished) return animateBack();
      animationFinishedRef.current = true;
      if (!dispatchBeforeAnimation) observeAction(invokeAction());
      scheduleFallback();
    });
  }, [dispatchBeforeAnimation, drag, onNext, onPrevious, onTransitionStart, panelWidth,
    reduceMotion, transition, transitionDurationMs]);
  return { switchingRef: transition.switchingRef, animateBack: transition.animateBack, complete,
    pageOffset: transition.pageOffset, pageOffsetRef: transition.pageOffsetRef };
};

interface HorizontalMotionOptions extends Omit<TrackSwitchOptions, 'drag'> {
  hasPrevious: boolean;
  hasNext: boolean;
}

export const useHorizontalTrackMotion = ({ currentSongId, panelWidth, onNext, onPrevious,
  hasPrevious, hasNext, reduceMotion, transitionDurationMs, dispatchBeforeAnimation, onTransitionStart,
  onTransitionEnd }: HorizontalMotionOptions) => {
  const drag = useRef(new Animated.Value(0)).current;
  const gestureDrag = useRef(new Animated.Value(0)).current;
  const followGesture = useRef(new Animated.Value(0)).current;
  const switching = useTrackSwitchAnimation({ drag, currentSongId, panelWidth, onNext, onPrevious,
    reduceMotion, transitionDurationMs, dispatchBeforeAnimation, onTransitionStart, onTransitionEnd });
  const constrainedGesture = useMemo(() => gestureDrag.interpolate({ inputRange: [-panelWidth, 0, panelWidth],
    outputRange: [hasNext ? -panelWidth : -panelWidth * 0.12, 0,
      hasPrevious ? panelWidth : panelWidth * 0.12], extrapolate: 'clamp' }),
  [gestureDrag, hasNext, hasPrevious, panelWidth]);
  // Only gesture input is bounded/rebased. Released native animation endpoints
  // stay untouched while React commits the pages and their layout offset.
  const visibleDrag = useMemo(() => Animated.add(
    Animated.multiply(Animated.subtract(constrainedGesture, switching.pageOffset), followGesture),
    Animated.multiply(drag, Animated.subtract(1, followGesture)),
  ), [constrainedGesture, drag, followGesture, switching.pageOffset]);
  useLayoutEffect(() => {
    if (!switching.switchingRef.current) followGesture.setValue(0);
  }, [currentSongId, followGesture, switching.switchingRef]);
  const onGestureEvent = useMemo(() => Animated.event<PanGestureHandlerGestureEvent['nativeEvent']>(
    [{ nativeEvent: { translationX: gestureDrag } }],
    { useNativeDriver: true },
  ), [gestureDrag]);
  const handOffGesture = useCallback((position: number) => {
    const bounded = Math.max(-panelWidth, Math.min(panelWidth, position));
    const allowed = bounded < 0 ? hasNext : hasPrevious;
    drag.setValue((allowed ? bounded : bounded * 0.12) - switching.pageOffsetRef.current);
    followGesture.setValue(0);
  }, [drag, followGesture, hasNext, hasPrevious, panelWidth, switching.pageOffsetRef]);
  const onStateChange = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { oldState, state, translationX = 0, translationY = 0, velocityX = 0 } = event.nativeEvent;
    if (state === State.BEGAN || state === State.ACTIVE) {
      if (!switching.switchingRef.current) {
        gestureDrag.setValue(translationX);
        followGesture.setValue(1);
      }
      return;
    }
    if (state === State.CANCELLED || state === State.FAILED) {
      // A tap or a child waveform gesture can fail this passive recognizer
      // while an earlier track switch is still animating. A second cancelled
      // gesture must not replace that transition with a return spring.
      if (oldState === State.ACTIVE && !switching.switchingRef.current) {
        handOffGesture(translationX);
        switching.animateBack();
      }
    } else if (state === State.END && oldState === State.ACTIVE) {
      if (switching.switchingRef.current) return;
      // Capture the release before freezing pages and stop following native
      // gesture events. They may still arrive after the recognizer is disabled.
      handOffGesture(translationX);
      const wantsNext = translationX < 0;
      const allowed = wantsNext ? hasNext : hasPrevious;
      if (allowed && shouldCommitSoundCloudSwipe({ translationX, translationY, velocityX, width: panelWidth }))
        switching.complete(wantsNext ? 'next' : 'previous');
      else switching.animateBack();
    }
  }, [followGesture, gestureDrag, handOffGesture, hasNext, hasPrevious, panelWidth, switching]);
  return { drag, constrainedDrag: visibleDrag, pageOffset: switching.pageOffset, onGestureEvent, onStateChange };
};

export const useVerticalPlayerMotion = ({ drag, height, onCollapse, onOpenQueue,
  onQueuePreviewStart, onQueuePreviewEnd, reduceMotion }: {
  drag: Animated.Value;
  height: number;
  onCollapse: () => void;
  onOpenQueue: () => void;
  onQueuePreviewStart?: () => void;
  onQueuePreviewEnd?: () => void;
  reduceMotion: boolean;
}) => {
  const previewingRef = useRef(false);
  useEffect(() => () => drag.stopAnimation(), [drag]);
  const finishQueuePreview = useCallback(() => {
    if (!previewingRef.current) return;
    previewingRef.current = false;
    onQueuePreviewEnd?.();
  }, [onQueuePreviewEnd]);
  const animateBack = useCallback(() => {
    if (reduceMotion) {
      drag.stopAnimation();
      drag.setValue(0);
      finishQueuePreview();
      return;
    }
    Animated.spring(drag, { toValue: 0, tension: 150, friction: 22, useNativeDriver: true })
      .start(({ finished }) => { if (finished) finishQueuePreview(); });
  }, [drag, finishQueuePreview, reduceMotion]);
  const onGestureEvent = useMemo(() => Animated.event<PanGestureHandlerGestureEvent['nativeEvent']>(
    [{ nativeEvent: { translationY: drag } }],
    {
      useNativeDriver: true,
      listener: (event: PanGestureHandlerGestureEvent) => {
        const translationY = event.nativeEvent.translationY ?? 0;
        if (translationY < 0 && !previewingRef.current) {
          previewingRef.current = true;
          onQueuePreviewStart?.();
        }
      },
    },
  ), [drag, onQueuePreviewStart]);
  const onStateChange = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { oldState, state, translationX = 0, translationY = 0, velocityY = 0 } = event.nativeEvent;
    if (state === State.CANCELLED || state === State.FAILED) {
      // A button tap also ends a passive parent recognizer. It must not cancel
      // the queue-open animation triggered by that same tap.
      if (oldState === State.ACTIVE) animateBack();
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
      previewingRef.current = false;
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
