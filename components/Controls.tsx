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
import { useAppTheme } from '../contexts/AppThemeContext';
import { theme as staticTheme } from '../theme';
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
  accentDarkColor?: string;
}

const PressScale: React.FC<PressScaleProps> = ({
  children,
  testID,
  accessibilityLabel,
  onPress,
  disabled,
  size = 44,
  primary,
  accentColor,
  accentDarkColor,
}) => {
  const { theme } = useAppTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: primary ? accentColor ?? theme.palette.primary : theme.palette.surfaceGlass,
          borderColor: primary ? accentDarkColor ?? theme.palette.primaryDark : theme.palette.border,
          borderWidth: primary ? 1 : StyleSheet.hairlineWidth,
          shadowColor: primary ? accentColor ?? theme.palette.primary : 'transparent',
        },
        disabled && styles.disabled,
        primary && styles.primaryGlow,
      ]}
    >
      {children}
    </Pressable>
  );
};

interface ControlsProps {
  accentColor?: string;
  accentDarkColor?: string;
  onAccentColor?: string;
}

const Controls: React.FC<ControlsProps> = ({
  accentColor,
  accentDarkColor,
  onAccentColor,
}) => {
  const { theme } = useAppTheme();
  const resolvedAccentColor = accentColor ?? theme.palette.primary;
  const resolvedAccentDarkColor = accentDarkColor ?? theme.palette.primaryDark;
  const resolvedOnAccentColor = onAccentColor ?? theme.palette.text.onPrimary;

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
    const color = repeatMode === 'off' ? theme.palette.text.muted : resolvedAccentColor;
    return repeatMode === 'one'
      ? <Repeat1 color={color} size={18} />
      : <Repeat color={color} size={18} />;
  }, [repeatMode, resolvedAccentColor, theme.palette.text.muted]);

  const shuffleColor = shuffle ? resolvedAccentColor : theme.palette.text.muted;
  const canSkipNext = !!currentSong && playbackQueue.length > 1;
  const canSkipPrevious = !!currentSong;

  return (
    <View style={styles.container} testID="controls">
      <PressScale
        testID="controls-shuffle"
        accessibilityLabel={shuffle ? 'Zufallswiedergabe aus' : 'Zufallswiedergabe an'}
        onPress={toggleShuffle}
        size={36}
        accentColor={shuffle ? resolvedAccentColor : theme.palette.border}
        accentDarkColor={resolvedAccentDarkColor}
      >
        <Shuffle color={shuffleColor} size={18} />
      </PressScale>

      <PressScale
        testID="controls-previous"
        accessibilityLabel="Vorheriger Titel"
        onPress={previous}
        disabled={!canSkipPrevious}
        size={44}
      >
        <SkipBack color={theme.palette.text.primary} size={21} fill={theme.palette.text.primary} />
      </PressScale>

      <PressScale
        testID="controls-play-pause"
        accessibilityLabel={isPlaying ? 'Pausieren' : 'Abspielen'}
        onPress={togglePlayPause}
        disabled={!currentSong || isBuffering}
        size={58}
        primary
        accentColor={resolvedAccentColor}
        accentDarkColor={resolvedAccentDarkColor}
      >
        {isPlaying ? (
          <Pause color={resolvedOnAccentColor} size={25} fill={resolvedOnAccentColor} />
        ) : (
          <Play color={resolvedOnAccentColor} size={25} fill={resolvedOnAccentColor} />
        )}
      </PressScale>

      <PressScale
        testID="controls-next"
        accessibilityLabel="Nächster Titel"
        onPress={next}
        disabled={!canSkipNext}
        size={44}
      >
        <SkipForward color={theme.palette.text.primary} size={21} fill={theme.palette.text.primary} />
      </PressScale>

      <PressScale
        testID="controls-repeat"
        accessibilityLabel={REPEAT_MODE_LABELS[repeatMode]}
        onPress={cycleRepeatMode}
        size={36}
        accentColor={repeatMode !== 'off' ? resolvedAccentColor : theme.palette.border}
        accentDarkColor={resolvedAccentDarkColor}
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
    paddingVertical: staticTheme.spacing.xs,
    paddingHorizontal: staticTheme.spacing.sm,
    gap: staticTheme.spacing.xs,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryGlow: {
    shadowOpacity: 0.18,
    shadowRadius: 9,
    elevation: 4,
  },
  disabled: { opacity: 0.35 },
});

export default Controls;
