import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
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
import type { RepeatMode } from '../types/Song';

const REPEAT_MODE_LABELS: Record<RepeatMode, string> = {
  off: 'Wiederholung aus',
  one: 'Titel wiederholen',
  all: 'Alle Titel wiederholen',
};

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
  size = 48,
  primary,
  accentColor,
}) => (
  <Pressable
    testID={testID}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ disabled: !!disabled }}
    onPress={onPress}
    disabled={disabled}
    hitSlop={8}
    style={[
      styles.button,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: primary ? theme.palette.primary : theme.palette.surfaceElevated,
        borderColor: primary ? theme.palette.primaryDark : accentColor ?? theme.palette.border,
        borderWidth: accentColor ? 1.5 : 1,
      },
      disabled && styles.disabled,
      primary && styles.primaryGlow,
    ]}
  >
    {children}
  </Pressable>
);

const Controls: React.FC = () => {
  const {
    isPlaying,
    isBuffering,
    togglePlayPause,
    next,
    previous,
    currentSong,
    playbackQueue,
    shuffle,
    toggleShuffle,
    repeatMode,
    cycleRepeatMode,
  } = useMusicContext();

  const repeatIcon = useMemo(() => {
    const color = repeatMode === 'off' ? theme.palette.text.muted : theme.palette.primary;
    return repeatMode === 'one'
      ? <Repeat1 color={color} size={18} />
      : <Repeat color={color} size={18} />;
  }, [repeatMode]);

  const shuffleColor = shuffle ? theme.palette.primary : theme.palette.text.muted;
  const canSkipNext = !!currentSong && playbackQueue.length > 1;
  const canSkipPrevious = !!currentSong;

  return (
    <View style={styles.container} testID="controls">
      <PressScale
        testID="controls-shuffle"
        accessibilityLabel={shuffle ? 'Zufallswiedergabe aus' : 'Zufallswiedergabe an'}
        onPress={toggleShuffle}
        size={38}
        accentColor={shuffle ? theme.palette.primary : theme.palette.border}
      >
        <Shuffle color={shuffleColor} size={18} />
      </PressScale>

      <PressScale
        testID="controls-previous"
        accessibilityLabel="Vorheriger Titel"
        onPress={previous}
        disabled={!canSkipPrevious}
        size={48}
      >
        <SkipBack color={theme.palette.text.primary} size={23} fill={theme.palette.text.primary} />
      </PressScale>

      <PressScale
        testID="controls-play-pause"
        accessibilityLabel={isPlaying ? 'Pausieren' : 'Abspielen'}
        onPress={togglePlayPause}
        disabled={!currentSong || isBuffering}
        size={62}
        primary
      >
        {isPlaying ? (
          <Pause color={theme.palette.text.onPrimary} size={27} fill={theme.palette.text.onPrimary} />
        ) : (
          <Play color={theme.palette.text.onPrimary} size={27} fill={theme.palette.text.onPrimary} />
        )}
      </PressScale>

      <PressScale
        testID="controls-next"
        accessibilityLabel="Nächster Titel"
        onPress={next}
        disabled={!canSkipNext}
        size={48}
      >
        <SkipForward color={theme.palette.text.primary} size={23} fill={theme.palette.text.primary} />
      </PressScale>

      <PressScale
        testID="controls-repeat"
        accessibilityLabel={REPEAT_MODE_LABELS[repeatMode]}
        onPress={cycleRepeatMode}
        size={38}
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
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryGlow: {
    shadowColor: theme.palette.primary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  disabled: { opacity: 0.35 },
});

export default Controls;
