import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
} from 'react-native';
import { theme } from '../theme';

interface ProgressBarProps {
  currentPosition: number;
  duration: number;
  onSeek: (position: number) => void;
}

const formatTime = (millis: number): string => {
  if (!isFinite(millis) || millis < 0) return '0:00';
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const ProgressBar: React.FC<ProgressBarProps> = ({ currentPosition, duration, onSeek }) => {
  const [barWidth, setBarWidth] = useState(0);
  const progress = duration > 0 ? Math.min(100, (currentPosition / duration) * 100) : 0;

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  }, []);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (barWidth <= 0 || duration <= 0) return;
      const { locationX } = event.nativeEvent;
      const ratio = Math.max(0, Math.min(1, locationX / barWidth));
      onSeek(ratio * duration);
    },
    [barWidth, duration, onSeek],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.time}>{formatTime(currentPosition)}</Text>
      <Pressable
        testID="progress-bar"
        accessibilityRole="adjustable"
        accessibilityValue={{ now: Math.round(progress), min: 0, max: 100 }}
        style={styles.progressBarContainer}
        onLayout={handleLayout}
        onPress={handlePress}
      >
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
      </Pressable>
      <Text style={styles.time}>{formatTime(duration)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
  },
  time: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    minWidth: 45,
    textAlign: 'center',
  },
  progressBarContainer: {
    flex: 1,
    marginHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: theme.palette.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.palette.primary,
  },
});

export default ProgressBar;
