import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { useAppTheme } from '../contexts/AppThemeContext';

interface EqualizerCurveChartProps {
  curvePath: string;
}

const EqualizerCurveChart: React.FC<EqualizerCurveChartProps> = ({ curvePath }) => {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.curveWrap,
        {
          borderColor: theme.palette.border,
          backgroundColor: theme.palette.surface,
        },
      ]}
      testID="equalizer-curve-chart"
    >
      <Svg width="100%" height="80" viewBox="0 0 320 80">
        <Line x1="0" y1="40" x2="320" y2="40" stroke={theme.palette.borderStrong} strokeDasharray="4,4" strokeWidth="1" />
        <Path d={curvePath} stroke={theme.palette.primary} strokeWidth={2} fill={theme.palette.primaryGlow} />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  curveWrap: {
    marginBottom: APP_THEME_TOKENS.spacing.md,
    borderWidth: 1,
    borderRadius: APP_THEME_TOKENS.radii.card,
    padding: 8,
  },
});

export default EqualizerCurveChart;
