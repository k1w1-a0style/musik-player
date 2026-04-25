import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react-native';
import { useMusicContext } from '../contexts/MusicContext';
import { theme } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressScaleProps {
  children: React.ReactNode;
  testID: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  primary?: boolean;
  accentColor?: string;
}

const PressScale: React.FC<PressScaleProps> = ({
  children,
  testID,
  accessibilityLabel,
  onPress,
  disabled,
  size = 56,
  primary,
  accentColor,
}) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.88, { duration: 80, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 12, stiffness: 220 }),
    );
    onPress();
  };
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      disabled={disabled}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: primary ? theme.palette.primary : theme.palette.surfaceElevated,
          borderColor: primary
            ? theme.palette.primaryDark
            : accentColor ?? theme.palette.border,
          borderWidth: accentColor ? 1.5 : 1,
        },
        disabled && styles.disabled,
        primary && theme.shadows.glow,
        animStyle,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
};

const Controls: React.FC = () => {
  const {
    isPlaying,
    isBuffering,
    togglePlayPause,
    next,
    previous,
    currentSong,
    shuffle,
    toggleShuffle,
    repeatMode,
    cycleRepeatMode,
  } = useMusicContext();

  // Subtle "breathing" pulse on the play button while playing
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withTiming(isPlaying ? 1.04 : 1, {
      duration: 600,
      easing: Easing.inOut(Easing.quad),
    });
  }, [isPlaying, pulse]);
  const playPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const repeatIcon = useMemo(() => {
    const color =
      repeatMode === 'off' ? theme.palette.text.muted : theme.palette.primary;
    return repeatMode === 'one' ? (
      <Repeat1 color={color} size={20} />
    ) : (
      <Repeat color={color} size={20} />
    );
  }, [repeatMode]);

  const shuffleColor = shuffle ? theme.palette.primary : theme.palette.text.muted;

  return (
    <View style={styles.container} testID="controls">
      <PressScale
        testID="controls-shuffle"
        accessibilityLabel={shuffle ? 'Shuffle aus' : 'Shuffle an'}
        onPress={toggleShuffle}
        size={44}
        accentColor={shuffle ? theme.palette.primary : theme.palette.border}
      >
        <Shuffle color={shuffleColor} size={20} />
      </PressScale>

      <PressScale
        testID="controls-previous"
        accessibilityLabel="Vorheriger Titel"
        onPress={previous}
        disabled={!currentSong}
        size={56}
      >
        <SkipBack color={theme.palette.text.primary} size={26} fill={theme.palette.text.primary} />
      </PressScale>

      <Animated.View style={playPulseStyle}>
        <PressScale
          testID="controls-play-pause"
          accessibilityLabel={isPlaying ? 'Pause' : 'Abspielen'}
          onPress={togglePlayPause}
          disabled={!currentSong || isBuffering}
          size={76}
          primary
        >
          {isPlaying ? (
            <Pause color={theme.palette.text.onPrimary} size={32} fill={theme.palette.text.onPrimary} />
          ) : (
            <Play color={theme.palette.text.onPrimary} size={32} fill={theme.palette.text.onPrimary} />
          )}
        </PressScale>
      </Animated.View>

      <PressScale
        testID="controls-next"
        accessibilityLabel="Nächster Titel"
        onPress={next}
        disabled={!currentSong}
        size={56}
      >
        <SkipForward color={theme.palette.text.primary} size={26} fill={theme.palette.text.primary} />
      </PressScale>

      <PressScale
        testID="controls-repeat"
        accessibilityLabel={`Wiederholung: ${repeatMode}`}
        onPress={cycleRepeatMode}
        size={44}
        accentColor={repeatMode !== 'off' ? theme.palette.primary : theme.palette.border}
      >
        {repeatIcon}
      </PressScale>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
});

export default Controls;
