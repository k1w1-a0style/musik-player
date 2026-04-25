import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  withRepeat,
  useDerivedValue,
} from 'react-native-reanimated';
import { theme } from '../theme';

interface Props {
  bins: number[];
  active: boolean;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

const Bar: React.FC<{ idx: number; total: number; activeBlend: Animated.SharedValue<number>; value: number; phase: Animated.SharedValue<number>; color: string }> = ({ idx, total, activeBlend, value, phase, color }) => {
  const live = useSharedValue(0.2);
  useEffect(() => {
    live.value = withTiming(Math.max(0.04, value), { duration: 140, easing: Easing.out(Easing.quad) });
  }, [value, live]);

  const idle = useDerivedValue(() => {
    const wave = 0.15 + 0.12 * Math.sin(idx * 0.7 + phase.value);
    return Math.max(0.06, wave);
  });

  const style = useAnimatedStyle(() => {
    const v = idle.value * (1 - activeBlend.value) + live.value * activeBlend.value;
    return {
      transform: [{ scaleY: v }],
      opacity: activeBlend.value > 0.5 ? 0.6 + v * 0.4 : 0.3,
    };
  });

  const t = idx / Math.max(1, total - 1);
  return <Animated.View style={[styles.bar, { backgroundColor: color, marginHorizontal: 1 + (1 - Math.abs(0.5 - t)) }, style]} />;
};

const Visualizer: React.FC<Props> = ({ bins, active, color, height = 56, style }) => {
  const phase = useSharedValue(0);
  const activeBlend = useSharedValue(active && bins.length > 0 ? 1 : 0);

  useEffect(() => {
    phase.value = withRepeat(withTiming(Math.PI * 2, { duration: 2800, easing: Easing.linear }), -1, false);
  }, [phase]);

  useEffect(() => {
    activeBlend.value = withTiming(active && bins.length > 0 ? 1 : 0, { duration: 280 });
  }, [active, bins.length, activeBlend]);

  const data = active && bins.length > 0 ? bins : Array.from({ length: 16 }, () => 0.2);

  return (
    <View style={[styles.row, { height }, style]} testID="visualizer">
      {data.map((v, i) => (
        <Bar key={i} idx={i} total={data.length} value={v} activeBlend={activeBlend} phase={phase} color={color ?? theme.palette.primary} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', width: '100%' },
  bar: { flex: 1, height: '100%', borderRadius: 2 },
});

export default Visualizer;
