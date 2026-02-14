import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

interface ProgressBarProps {
  currentPosition: number;
  duration: number;
  onSeek: (position: number) => void;
}

const formatTime = (millis: number): string => {
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const ProgressBar: React.FC<ProgressBarProps> = ({ currentPosition, duration, onSeek }) => {
  const progress = duration > 0 ? (currentPosition / duration) * 100 : 0;

  const handlePress = (event: any) => {
    const { locationX } = event.nativeEvent;
    const barWidth = event.currentTarget.offsetWidth || 300;
    const newPosition = (locationX / barWidth) * duration;
    onSeek(newPosition);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.time}>{formatTime(currentPosition)}</Text>
      <TouchableOpacity
        style={styles.progressBarContainer}
        activeOpacity={1}
        onPress={handlePress}
      >
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
      </TouchableOpacity>
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
