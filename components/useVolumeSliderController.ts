import { useCallback, useRef, useState } from 'react';
import type {
  AccessibilityActionEvent,
  GestureResponderEvent,
  LayoutChangeEvent,
  View,
} from 'react-native';

const ACCESSIBILITY_VOLUME_STEP = 0.1;

export const clampVolume = (value: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));

interface VolumeSliderControllerOptions {
  volume: number;
  onVolumeChange: (value: number) => void | Promise<void>;
}

export const useVolumeSliderController = ({
  volume,
  onVolumeChange,
}: VolumeSliderControllerOptions) => {
  const trackRef = useRef<View>(null);
  const trackFrameRef = useRef({ x: 0, width: 1 });
  const [trackWidth, setTrackWidth] = useState(1);

  const commitVolume = useCallback((value: number) => {
    try {
      void Promise.resolve(onVolumeChange(clampVolume(value))).catch(error => {
        console.warn('[VolumeSlider] Failed to apply volume.', error);
      });
    } catch (error) {
      console.warn('[VolumeSlider] Failed to apply volume.', error);
    }
  }, [onVolumeChange]);

  const updateTrackFrame = useCallback(() => {
    trackRef.current?.measureInWindow((x, _y, width) => {
      const safeWidth = Math.max(1, width);
      trackFrameRef.current = { x, width: safeWidth };
      setTrackWidth(safeWidth);
    });
  }, []);

  const onTrackLayout = useCallback((event: LayoutChangeEvent) => {
    const safeWidth = Math.max(1, event.nativeEvent.layout.width);
    trackFrameRef.current = { ...trackFrameRef.current, width: safeWidth };
    setTrackWidth(safeWidth);
    requestAnimationFrame(updateTrackFrame);
  }, [updateTrackFrame]);

  const volumeFromTouch = useCallback((event: GestureResponderEvent): number => {
    const { pageX, locationX } = event.nativeEvent;
    const frame = trackFrameRef.current;
    if (typeof pageX === 'number' && Number.isFinite(pageX)) {
      return clampVolume((pageX - frame.x) / Math.max(1, frame.width));
    }
    if (typeof locationX === 'number' && Number.isFinite(locationX)) {
      return clampVolume(locationX / Math.max(1, trackWidth));
    }
    return clampVolume(volume);
  }, [trackWidth, volume]);

  const applyFromTouch = useCallback((event: GestureResponderEvent) => {
    commitVolume(volumeFromTouch(event));
  }, [commitVolume, volumeFromTouch]);

  const handleAccessibilityAction = useCallback((event: AccessibilityActionEvent) => {
    const direction = event.nativeEvent.actionName === 'increment'
      ? 1
      : event.nativeEvent.actionName === 'decrement'
        ? -1
        : 0;
    if (direction !== 0) {
      const currentVolume = clampVolume(volume);
      commitVolume(clampVolume(currentVolume + direction * ACCESSIBILITY_VOLUME_STEP));
    }
  }, [commitVolume, volume]);

  return {
    applyFromTouch,
    handleAccessibilityAction,
    onTrackLayout,
    percent: Math.round(clampVolume(volume) * 100),
    trackRef,
  };
};
