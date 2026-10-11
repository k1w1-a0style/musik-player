import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { State, type PanGestureHandlerGestureEvent, type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { shouldCollapseSoundCloudPlayer, shouldOpenSoundCloudQueue } from '../utils/soundCloudPlayer';

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
