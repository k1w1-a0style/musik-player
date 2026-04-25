import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, GestureResponderEvent, LayoutChangeEvent, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

interface ProgressBarProps {
  currentPosition: number;
  duration: number;
  onSeek: (position: number) => void;
  accent?: string;
  accentDark?: string;
}

const formatTime = (millis: number): string => {
  if (!isFinite(millis) || millis < 0) return '0:00';
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const ProgressBar: React.FC<ProgressBarProps> = ({ currentPosition, duration, onSeek, accent, accentDark }) => {
  const [barWidth, setBarWidth] = useState(0);
  const thumbScale = useSharedValue(1);
  const progress = duration > 0 ? Math.min(100, (currentPosition / duration) * 100) : 0;

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ scale: thumbScale.value }] }));

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  }, []);

  const handlePress = useCallback((event: GestureResponderEvent) => {
    if (barWidth <= 0 || duration <= 0) return;
    const { locationX } = event.nativeEvent;
    const ratio = Math.max(0, Math.min(1, locationX / barWidth));
    onSeek(ratio * duration);
  }, [barWidth, duration, onSeek]);

  return (
    <View style={styles.container}>
      <Pressable
        testID="progress-bar"
        accessibilityRole="adjustable"
        accessibilityValue={{ now: Math.round(progress), min: 0, max: 100 }}
        style={styles.progressBarContainer}
        onLayout={handleLayout}
        onPress={handlePress}
        onPressIn={() => { thumbScale.value = withSpring(1.4); }}
        onPressOut={() => { thumbScale.value = withSpring(1); }}
      >
        <View style={styles.progressBarBackground}>
          <LinearGradient
            colors={[accent ?? theme.palette.primary, accentDark ?? theme.palette.primaryDark]}
            style={[styles.progressBarFill, { width: `${progress}%` }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Animated.View style={[styles.thumb, { left: `${progress}%` }, thumbStyle]} />
        </View>
      </Pressable>
      <View style={styles.timeRow}>
        <Text style={styles.time}>{formatTime(currentPosition)}</Text>
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: theme.spacing.md, marginVertical: theme.spacing.sm, width: '100%' },
  progressBarContainer: { paddingVertical: 12 },
  progressBarBackground: { height: 4, backgroundColor: theme.palette.border, borderRadius: 2 },
  progressBarFill: { height: '100%', borderRadius: 2 },
  thumb: {
    position: 'absolute', top: -5, width: 14, height: 14, borderRadius: 7,
    backgroundColor: theme.palette.primary, marginLeft: -7,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.xs },
  time: { color: theme.palette.text.secondary, fontSize: 11, fontFamily: theme.fonts.body, letterSpacing: 0.5 },
});

export default ProgressBar;
