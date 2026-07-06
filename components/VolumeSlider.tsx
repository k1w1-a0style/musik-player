import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { Volume2, VolumeX } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { theme as staticTheme } from '../theme';

interface Props {
  volume: number;
  onVolumeChange: (v: number) => void;
  accentColor?: string;
  inactiveColor?: string;
}

const clampVolume = (value: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
const ACCESSIBILITY_VOLUME_STEP = 0.1;

const VolumeSlider: React.FC<Props> = ({
  volume,
  onVolumeChange,
  accentColor,
  inactiveColor,
}) => {
  const { theme } = useAppTheme();
  const resolvedAccentColor = accentColor ?? theme.palette.primary;
  const resolvedInactiveColor = inactiveColor ?? theme.palette.borderStrong;
  const trackRef = useRef<View>(null);
  const trackFrameRef = useRef({ x: 0, width: 1 });
  const [trackWidth, setTrackWidth] = useState(1);

  const commitVolume = useCallback((value: number) => {
    onVolumeChange(clampVolume(value));
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

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const currentVolume = clampVolume(volume);
      if (event.nativeEvent.actionName === 'increment') {
        commitVolume(clampVolume(currentVolume + ACCESSIBILITY_VOLUME_STEP));
      } else if (event.nativeEvent.actionName === 'decrement') {
        commitVolume(clampVolume(currentVolume - ACCESSIBILITY_VOLUME_STEP));
      }
    },
    [commitVolume, volume],
  );

  const percent = Math.round(clampVolume(volume) * 100);

  return (
    <View style={styles.container} testID="modern-controls">
      <View style={styles.row}>
        {volume <= 0.01 ? (
          <VolumeX color={theme.palette.text.muted} size={18} />
        ) : (
          <Volume2 color={resolvedAccentColor} size={18} />
        )}
        <View
          ref={trackRef}
          testID="volume-slider"
          accessibilityRole="adjustable"
          accessibilityLabel="Lautstärke"
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          accessibilityValue={{ min: 0, max: 100, now: percent }}
          onAccessibilityAction={handleAccessibilityAction}
          style={styles.sliderHitbox}
          onLayout={onTrackLayout}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onStartShouldSetResponderCapture={() => true}
          onMoveShouldSetResponderCapture={() => true}
          onResponderGrant={applyFromTouch}
          onResponderMove={applyFromTouch}
          onResponderTerminationRequest={() => false}
        >
          <View testID="volume-track" style={[styles.track, { backgroundColor: resolvedInactiveColor }]}>
            <View testID="volume-track-active" style={[styles.trackActive, { width: `${percent}%`, backgroundColor: resolvedAccentColor }]} />
            <View testID="volume-thumb" style={[styles.thumb, { left: `${percent}%`, backgroundColor: resolvedAccentColor }]} />
          </View>
        </View>
        <Text style={[styles.value, { color: theme.palette.text.secondary }]}>{percent}%</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.sm,
  },
  sliderHitbox: {
    flex: 1,
    minWidth: 128,
    height: 42,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 999,
    overflow: 'visible',
  },
  trackActive: {
    height: 4,
    borderRadius: 999,
  },
  thumb: {
    position: 'absolute',
    top: -7,
    width: 18,
    height: 18,
    marginLeft: -9,
    borderRadius: 9,
  },
  value: {
    fontSize: 11,
    minWidth: 40,
    textAlign: 'right',
    fontFamily: staticTheme.fonts.mono,
  },
});

export default VolumeSlider;
