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
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import type { RepeatMode } from '../types/Song';
import { canSkipToNextInQueue } from '../utils/playbackQueueGuards';

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
  active?: boolean;
  accentColor?: string;
  accentDarkColor?: string;
}

const PressScale: React.FC<PressScaleProps> = ({
  children,
  testID,
  accessibilityLabel,
  onPress,
  disabled,
  size = 42,
  primary,
  active,
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
          backgroundColor: primary
            ? accentColor ?? theme.palette.primary
            : active
              ? theme.palette.primaryGlow
              : theme.palette.surfaceGlass,
          borderColor: primary
            ? accentDarkColor ?? theme.palette.primaryDark
            : active
              ? accentColor ?? theme.palette.primary
              : theme.palette.border,
          shadowColor: primary ? accentColor ?? accentDarkColor ?? theme.palette.primary : 'transparent',
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
      ? <Repeat1 color={color} size={17} />
      : <Repeat color={color} size={17} />;
  }, [repeatMode, resolvedAccentColor, theme.palette.text.muted]);

  const shuffleColor = shuffle ? resolvedAccentColor : theme.palette.text.muted;
  const canSkipNext = canSkipToNextInQueue({ currentSong, playbackQueue, repeatMode });
  const canSkipPrevious = !!currentSong;

  return (
    <View style={styles.container} testID="controls">
      <View
        style={[
          styles.controlRail,
          {
            backgroundColor: theme.palette.surfaceGlass,
            borderColor: theme.palette.border,
          },
        ]}
        testID="controls-rail"
      >
        <PressScale
          testID="controls-shuffle"
          accessibilityLabel={shuffle ? 'Zufallswiedergabe aus' : 'Zufallswiedergabe an'}
          onPress={toggleShuffle}
          size={36}
          active={shuffle}
          accentColor={resolvedAccentColor}
          accentDarkColor={resolvedAccentDarkColor}
        >
          <Shuffle color={shuffleColor} size={17} />
        </PressScale>

        <PressScale
          testID="controls-previous"
          accessibilityLabel="Vorheriger Titel"
          onPress={previous}
          disabled={!canSkipPrevious}
          size={42}
        >
          <SkipBack color={theme.palette.text.primary} size={20} fill={theme.palette.text.primary} />
        </PressScale>

        <PressScale
          testID="controls-play-pause"
          accessibilityLabel={isPlaying ? 'Pausieren' : 'Abspielen'}
          onPress={togglePlayPause}
          disabled={!currentSong || isBuffering}
          size={56}
          primary
          accentColor={resolvedAccentColor}
          accentDarkColor={resolvedAccentDarkColor}
        >
          {isPlaying ? (
            <Pause color={resolvedOnAccentColor} size={24} fill={resolvedOnAccentColor} />
          ) : (
            <Play color={resolvedOnAccentColor} size={24} fill={resolvedOnAccentColor} />
          )}
        </PressScale>

        <PressScale
          testID="controls-next"
          accessibilityLabel="Nächster Titel"
          onPress={next}
          disabled={!canSkipNext}
          size={42}
        >
          <SkipForward color={theme.palette.text.primary} size={20} fill={theme.palette.text.primary} />
        </PressScale>

        <PressScale
          testID="controls-repeat"
          accessibilityLabel={REPEAT_MODE_LABELS[repeatMode]}
          onPress={cycleRepeatMode}
          size={36}
          active={repeatMode !== 'off'}
          accentColor={resolvedAccentColor}
          accentDarkColor={resolvedAccentDarkColor}
        >
          {repeatIcon}
        </PressScale>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: staticTokens.spacing.xs,
    paddingHorizontal: staticTokens.spacing.sm,
  },
  controlRail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  primaryGlow: {
    shadowOpacity: 0.20,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  disabled: { opacity: 0.35 },
});

export default Controls;
