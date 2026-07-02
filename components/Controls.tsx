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
}) => (
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
        backgroundColor: primary ? accentColor ?? theme.palette.primary : 'rgba(255,255,255,0.06)',
        borderColor: primary ? accentDarkColor ?? theme.palette.primaryDark : 'rgba(255,255,255,0.10)',
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
      <PressScale
        testID="controls-shuffle"
        accessibilityLabel={shuffle ? 'Zufallswiedergabe aus' : 'Zufallswiedergabe an'}
        onPress={toggleShuffle}
        size={36}
        accentColor={shuffle ? accentColor : theme.palette.border}
        accentDarkColor={accentDarkColor}
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
        accentColor={accentColor}
        accentDarkColor={accentDarkColor}
      >
        {isPlaying ? (
          <Pause color={onAccentColor} size={25} fill={onAccentColor} />
        ) : (
          <Play color={onAccentColor} size={25} fill={onAccentColor} />
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
        accentColor={repeatMode !== 'off' ? accentColor : theme.palette.border}
        accentDarkColor={accentDarkColor}
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
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    gap: theme.spacing.xs,
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
