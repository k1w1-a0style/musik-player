import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Volume2, VolumeX } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { useVolumeSliderController } from './useVolumeSliderController';

interface Props {
  volume: number;
  onVolumeChange: (v: number) => void | Promise<void>;
  accentColor?: string;
  inactiveColor?: string;
}

const VolumeSlider: React.FC<Props> = ({
  volume,
  onVolumeChange,
  accentColor,
  inactiveColor,
}) => {
  const { theme } = useAppTheme();
  const resolvedAccentColor = accentColor ?? theme.palette.primary;
  const resolvedInactiveColor = inactiveColor ?? theme.palette.borderStrong;
  const {
    applyFromTouch,
    handleAccessibilityAction,
    onTrackLayout,
    percent,
    trackRef,
  } = useVolumeSliderController({ volume, onVolumeChange });

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
    gap: APP_THEME_TOKENS.spacing.sm,
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
    fontFamily: APP_THEME_TOKENS.fonts.mono,
  },
});

export default VolumeSlider;
