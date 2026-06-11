import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from 'react-native';
import { Volume2, VolumeX } from 'lucide-react-native';
import { theme } from '../theme';

interface Props {
  volume: number;
  onVolumeChange: (v: number) => void;
}

const clampVolume = (value: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
const ACCESSIBILITY_VOLUME_STEP = 0.1;

const ModernControls: React.FC<Props> = ({ volume, onVolumeChange }) => {
  const [trackWidth, setTrackWidth] = useState(1);

  const applyFromTouch = useCallback((event: GestureResponderEvent) => {
    const x = event.nativeEvent.locationX;
    const next = clampVolume(x / Math.max(1, trackWidth));
    onVolumeChange(next);
  }, [onVolumeChange, trackWidth]);

  const onTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(Math.max(1, event.nativeEvent.layout.width));
  }, []);

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const currentVolume = clampVolume(volume);
      if (event.nativeEvent.actionName === 'increment') {
        onVolumeChange(clampVolume(currentVolume + ACCESSIBILITY_VOLUME_STEP));
      } else if (event.nativeEvent.actionName === 'decrement') {
        onVolumeChange(clampVolume(currentVolume - ACCESSIBILITY_VOLUME_STEP));
      }
    },
    [onVolumeChange, volume],
  );

  const percent = Math.round(clampVolume(volume) * 100);

  return (
    <View style={styles.container} testID="modern-controls">
      <View style={styles.row}>
        {volume <= 0.01 ? (
          <VolumeX color={theme.palette.text.muted} size={18} />
        ) : (
          <Volume2 color={theme.palette.primary} size={18} />
        )}
        <View
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
          onResponderGrant={applyFromTouch}
          onResponderMove={applyFromTouch}
        >
          <View style={styles.track}>
            <View style={[styles.trackActive, { width: `${percent}%` }]} />
            <View style={[styles.thumb, { left: `${percent}%` }]} />
          </View>
        </View>
        <Text style={styles.value}>{percent}%</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sliderHitbox: {
    flex: 1,
    minWidth: 128,
    height: 42,
    justifyContent: 'center',
  },
  track: {
    height: 5,
    borderRadius: 999,
    backgroundColor: theme.palette.border,
    overflow: 'visible',
  },
  trackActive: {
    height: 5,
    borderRadius: 999,
    backgroundColor: theme.palette.primary,
  },
  thumb: {
    position: 'absolute',
    top: -7,
    width: 19,
    height: 19,
    marginLeft: -9.5,
    borderRadius: 10,
    backgroundColor: theme.palette.primary,
  },
  value: {
    color: theme.palette.text.secondary,
    fontSize: 11,
    minWidth: 40,
    textAlign: 'right',
    fontFamily: theme.fonts.mono,
  },
});

export default ModernControls;
