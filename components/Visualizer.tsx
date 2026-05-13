import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { theme } from '../theme';

interface Props {
  bins: number[];
  active: boolean;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

const FALLBACK_BAR_COUNT = 18;

const Visualizer: React.FC<Props> = ({ bins, active, color, height = 56, style }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      anim.stopAnimation();
      anim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 620,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, anim]);

  const data = useMemo(
    () => (bins.length > 0 ? bins.slice(0, FALLBACK_BAR_COUNT) : Array.from({ length: FALLBACK_BAR_COUNT }, (_, i) => 0.18 + ((i * 7) % 10) / 18)),
    [bins],
  );

  return (
    <View style={[styles.row, { height }, style]} testID="visualizer">
      {data.map((v, i) => {
        const t = i / Math.max(1, data.length - 1);
        const base = Math.max(0.1, Math.min(1, v));
        const idleScale = 0.18 + base * 0.42;
        const phase = (i % 5) / 5;
        const animatedScale = anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [idleScale, Math.min(1, idleScale + 0.32 + phase * 0.2), idleScale],
        });

        return (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                backgroundColor: color ?? theme.palette.primary,
                marginHorizontal: 1 + (1 - Math.abs(0.5 - t)),
                opacity: active ? 0.62 + base * 0.35 : 0.28,
                transform: [{ scaleY: active ? animatedScale : idleScale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', width: '100%' },
  bar: { flex: 1, height: '100%', borderRadius: 2 },
});

export default Visualizer;
