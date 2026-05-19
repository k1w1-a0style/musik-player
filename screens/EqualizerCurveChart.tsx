import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { theme } from '../theme';

interface EqualizerCurveChartProps {
  curvePath: string;
}

const EqualizerCurveChart: React.FC<EqualizerCurveChartProps> = ({ curvePath }) => (
  <View style={styles.curveWrap}>
    <Svg width="100%" height="80" viewBox="0 0 320 80">
      <Line x1="0" y1="40" x2="320" y2="40" stroke={theme.palette.borderStrong} strokeDasharray="4,4" strokeWidth="1" />
      <Path d={curvePath} stroke={theme.palette.primary} strokeWidth={2} fill="rgba(245,179,1,0.08)" />
    </Svg>
  </View>
);

const styles = StyleSheet.create({
  curveWrap: { marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.palette.border, backgroundColor: theme.palette.surface, borderRadius: theme.borderRadius.md, padding: 8 },
});

export default EqualizerCurveChart;
