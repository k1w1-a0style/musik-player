import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { theme } from '../theme';

interface ModernControlsProps {
  playing: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onNext: () => void;
  onPrevious: () => void;
  currentTime: number;
  duration: number;
  onSeek: (value: number) => void;
  isLoading: boolean;
}

const ModernControls: React.FC<ModernControlsProps> = ({
  playing,
  onPlayPause,
  onStop,
  onNext,
  onPrevious,
  currentTime,
  duration,
  onSeek,
  isLoading,
}) => {
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration}
          value={currentTime}
          onSlidingComplete={onSeek}
          minimumTrackTintColor={theme.palette.primary}
          maximumTrackTintColor="rgba(255, 255, 255, 0.2)"
          thumbTintColor={theme.palette.primary}
        />
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>

      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={onPrevious}
          activeOpacity={0.7}
        >
          <Ionicons name="play-skip-back" size={32} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.playButton]}
          onPress={onPlayPause}
          activeOpacity={0.7}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <Ionicons
              name={playing ? 'pause' : 'play'}
              size={40}
              color="#fff"
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={onNext}
          activeOpacity={0.7}
        >
          <Ionicons name="play-skip-forward" size={32} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.extraControls}>
        <TouchableOpacity style={styles.extraButton} activeOpacity={0.7}>
          <Ionicons name="shuffle" size={24} color="rgba(255, 255, 255, 0.6)" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.extraButton}
          onPress={onStop}
          activeOpacity={0.7}
        >
          <Ionicons name="stop" size={24} color="rgba(255, 255, 255, 0.6)" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.extraButton} activeOpacity={0.7}>
          <Ionicons name="repeat" size={24} color="rgba(255, 255, 255, 0.6)" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  slider: {
    flex: 1,
    marginHorizontal: 12,
    height: 40,
  },
  timeText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.palette.primary,
    shadowColor: theme.palette.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  extraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  extraButton: {
    padding: 12,
  },
});

export default ModernControls;
