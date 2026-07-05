import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  type AccessibilityActionEvent,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Volume2, VolumeX } from 'lucide-react-native';
import { theme } from '../theme';

interface Props {
  volume: number;
  onVolumeChange: (v: number) => void;
  accentColor?: string;
  inactiveColor?: string;
}

const clampVolume = (value: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
const ACCESSIBILITY_VOLUME_STEP = 0.1;
const SLIDER_STEP = 0.01;

const VolumeSlider: React.FC<Props> = ({
  volume,
  onVolumeChange,
  accentColor = theme.palette.primary,
  inactiveColor = 'rgba(255,255,255,0.18)',
}) => {
  const [displayVolume, setDisplayVolume] = useState(() => clampVolume(volume));
  const [isSliding, setIsSliding] = useState(false);

  useEffect(() => {
    if (!isSliding) setDisplayVolume(clampVolume(volume));
  }, [isSliding, volume]);

  const commitVolume = useCallback((value: number) => {
    const next = clampVolume(value);
    setDisplayVolume(next);
    onVolumeChange(next);
  }, [onVolumeChange]);

  const handleValueChange = useCallback((value: number) => {
    commitVolume(value);
  }, [commitVolume]);

  const handleSlidingStart = useCallback(() => {
    setIsSliding(true);
  }, []);

  const handleSlidingComplete = useCallback((value: number) => {
    commitVolume(value);
    setIsSliding(false);
  }, [commitVolume]);

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const currentVolume = clampVolume(displayVolume);
      if (event.nativeEvent.actionName === 'increment') {
        commitVolume(clampVolume(currentVolume + ACCESSIBILITY_VOLUME_STEP));
      } else if (event.nativeEvent.actionName === 'decrement') {
        commitVolume(clampVolume(currentVolume - ACCESSIBILITY_VOLUME_STEP));
      }
    },
    [commitVolume, displayVolume],
  );

  const percent = Math.round(clampVolume(displayVolume) * 100);

  return (
    <View style={styles.container} testID="modern-controls">
      <View style={styles.row}>
        {displayVolume <= 0.01 ? (
          <VolumeX color={theme.palette.text.muted} size={18} />
        ) : (
          <Volume2 color={accentColor} size={18} />
        )}
        <Slider
          testID="volume-slider"
          accessibilityRole="adjustable"
          accessibilityLabel="Lautstärke"
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          accessibilityValue={{ min: 0, max: 100, now: percent }}
          onAccessibilityAction={handleAccessibilityAction}
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          step={SLIDER_STEP}
          value={displayVolume}
          onSlidingStart={handleSlidingStart}
          onValueChange={handleValueChange}
          onSlidingComplete={handleSlidingComplete}
          minimumTrackTintColor={accentColor}
          maximumTrackTintColor={inactiveColor}
          thumbTintColor={accentColor}
        />
        <Text style={styles.value}>{percent}%</Text>
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
    gap: theme.spacing.sm,
  },
  slider: {
    flex: 1,
    minWidth: 128,
    height: 38,
  },
  value: {
    color: theme.palette.text.secondary,
    fontSize: 11,
    minWidth: 40,
    textAlign: 'right',
    fontFamily: theme.fonts.mono,
  },
});

export default VolumeSlider;