import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../theme';

interface Props {
  bins: number[];
  active: boolean;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

const Bar: React.FC<{ value: number; color: string; idx: number; total: number }> = ({
  value,
  color,
  idx,
  total,
}) => {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withTiming(Math.max(0.04, value), {
      duration: 120,
      easing: Easing.out(Easing.quad),
    });
  }, [value, h]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: h.value }],
    opacity: 0.6 + h.value * 0.4,
  }));
  // Tint slightly across the spectrum
  const t = idx / Math.max(1, total - 1);
  return (
    <Animated.View
      style={[
        styles.bar,
        { backgroundColor: color },
        animStyle,
        { marginHorizontal: 1 + (1 - Math.abs(0.5 - t)) },
      ]}
    />
  );
};

/**
 * Live FFT visualizer. Renders a row of vertical bars whose height tracks
 * the magnitude of each FFT bin (values 0..1). Falls back to an idle pulse
 * when no data is flowing.
 */
const Visualizer: React.FC<Props> = ({ bins, active, color, height = 56, style }) => {
  const idleRef = useRef<number[]>(new Array(16).fill(0));
  const data = active && bins.length > 0 ? bins : idleRef.current;

  return (
    <View
      style={[styles.row, { height }, style]}
      testID="visualizer"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {data.map((v, i) => (
        <Bar
          key={i}
          value={v}
          color={color ?? theme.palette.primary}
          idx={i}
          total={data.length}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: '100%',
  },
  bar: {
    flex: 1,
    height: '100%',
    borderRadius: 2,
    transformOrigin: 'bottom',
  },
});

export default Visualizer;
