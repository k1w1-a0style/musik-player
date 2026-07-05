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
  size = 44,
  primary,
  active,
  accentColor,
  accentDarkColor,
}) => (
  <Pressable
    testID={testID}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ disabled: !!disabled }}
    onPress={onPress}
    disabled={disabled}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    style={({ pressed }) => [
      styles.button,
      primary ? styles.primaryButton : styles.secondaryButton,
      {
        width: size,
        height: size,
        borderRadius: primary ? 22 : size / 2,
        backgroundColor: primary ? accentColor ?? theme.palette.primary : active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.055)',
        borderColor: primary
          ? accentDarkColor ?? theme.palette.primaryDark
          : active
            ? accentColor ?? theme.palette.primary
            : 'rgba(255,255,255,0.11)',
        borderWidth: primary ? 1 : StyleSheet.hairlineWidth,
        shadowColor: primary ? accentColor ?? theme.palette.primary : 'transparent',
      },
      pressed && styles.pressed,
      disabled && styles.disabled,
      primary && styles.primaryGlow,
    ]}
  >
    {children}
  </Pressable>
);

interface ControlsProps {
  accentColor?: string;
  accentDarkColor?: string;
  onAccentColor?: string;
}

const Controls: React.FC<ControlsProps> = ({
  accentColor = theme.palette.primary,
  accentDarkColor = theme.palette.primaryDark,
  onAccentColor = theme.palette.text.onPrimary,
}) => {
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
    const color = repeatMode === 'off' ? theme.palette.text.muted : accentColor;
    return repeatMode === 'one'
      ? <Repeat1 color={color} size={18} />
      : <Repeat color={color} size={18} />;
  }, [accentColor, repeatMode]);

  const shuffleColor = shuffle ? accentColor : theme.palette.text.muted;
  const canSkipNext = !!currentSong && playbackQueue.length > 1;
  const canSkipPrevious = !!currentSong;

  return (
    <View style={styles.container} testID="controls">
      <View style={styles.controlRail}>
        <PressScale
          testID="controls-shuffle"
          accessibilityLabel={shuffle ? 'Zufallswiedergabe aus' : 'Zufallswiedergabe an'}
          onPress={toggleShuffle}
          size={38}
          active={shuffle}
          accentColor={accentColor}
          accentDarkColor={accentDarkColor}
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
          <SkipBack color={theme.palette.text.primary} size={22} fill={theme.palette.text.primary} />
        </PressScale>

        <PressScale
          testID="controls-play-pause"
          accessibilityLabel={isPlaying ? 'Pausieren' : 'Abspielen'}
          onPress={togglePlayPause}
          disabled={!currentSong || isBuffering}
          size={64}
          primary
          accentColor={accentColor}
          accentDarkColor={accentDarkColor}
        >
          {isPlaying ? (
            <Pause color={onAccentColor} size={27} fill={onAccentColor} />
          ) : (
            <Play color={onAccentColor} size={27} fill={onAccentColor} />
          )}
        </PressScale>

        <PressScale
          testID="controls-next"
          accessibilityLabel="Nächster Titel"
          onPress={next}
          disabled={!canSkipNext}
          size={48}
        >
          <SkipForward color={theme.palette.text.primary} size={22} fill={theme.palette.text.primary} />
        </PressScale>

        <PressScale
          testID="controls-repeat"
          accessibilityLabel={REPEAT_MODE_LABELS[repeatMode]}
          onPress={cycleRepeatMode}
          size={38}
          active={repeatMode !== 'off'}
          accentColor={accentColor}
          accentDarkColor={accentDarkColor}
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
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  controlRail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    overflow: 'hidden',
  },
  primaryButton: {
    overflow: 'hidden',
  },
  primaryGlow: {
    shadowOpacity: 0.26,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.35 },
});

export default Controls;