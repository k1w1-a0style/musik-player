import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { theme } from '../theme';

interface Props {
  bins: number[];
  active: boolean;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

const Visualizer: React.FC<Props> = ({ bins, active, color, height = 56, style }) => {
  const data = active && bins.length > 0 ? bins : Array.from({ length: 16 }, () => 0.2);

  return (
    <View style={[styles.row, { height }, style]} testID="visualizer">
      {data.map((v, i) => {
        const t = i / Math.max(1, data.length - 1);
        const scale = Math.max(0.08, Math.min(1, v));
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                backgroundColor: color ?? theme.palette.primary,
                marginHorizontal: 1 + (1 - Math.abs(0.5 - t)),
                opacity: active ? 0.5 + scale * 0.5 : 0.3,
                transform: [{ scaleY: scale }],
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
