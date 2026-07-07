import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { clampMiniPlayerProgress } from '../hooks/useMiniPlayerProgress';

interface MiniPlayerProgressProps {
  progress: number;
  accent?: string;
}

const MiniPlayerProgress: React.FC<MiniPlayerProgressProps> = ({ progress, accent }) => {
  const { theme } = useAppTheme();
  const clamped = clampMiniPlayerProgress(progress);

  return (
    <View
      pointerEvents="none"
      style={[styles.track, { backgroundColor: theme.palette.border }]}
      testID="mini-player-progress"
    >
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%`, backgroundColor: accent ?? theme.palette.primary },
        ]}
        testID="mini-player-progress-fill"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  fill: { height: '100%' },
});

export default MiniPlayerProgress;
