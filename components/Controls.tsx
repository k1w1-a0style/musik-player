import React, { useCallback, useMemo } from 'react';
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
import type { RepeatMode, Song } from '../types/Song';
import { canSkipToNextInQueue } from '../utils/playbackQueueGuards';
import { runPlaybackUiAction } from '../utils/playbackUiActions';
import CrossfadeLayers from './CrossfadeLayers';

const REPEAT_MODE_LABELS: Record<RepeatMode, string> = {
  off: 'Wiederholung aus',
  one: 'Titel wiederholen',
  all: 'Alle Titel wiederholen',
};

interface PressScaleProps {
  children: React.ReactNode;
  testID: string;
  accessibilityLabel: string;
  onPress: () => unknown | Promise<unknown>;
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
  const handlePress = useCallback(() => {
    void runPlaybackUiAction(testID, onPress, { dropIfPending: testID !== 'controls-repeat' });
  }, [onPress, testID]);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      onPress={handlePress}
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

interface AccentProps {
  accentColor: string;
  accentDarkColor: string;
}

const ShuffleControl: React.FC<AccentProps & {
  active: boolean;
  onPress: () => unknown | Promise<unknown>;
  inactiveColor: string;
}> = ({ active, onPress, accentColor, accentDarkColor, inactiveColor }) => (
  <PressScale
    testID="controls-shuffle"
    accessibilityLabel={active ? 'Zufallswiedergabe aus' : 'Zufallswiedergabe an'}
    onPress={onPress}
    size={36}
    active={active}
    accentColor={accentColor}
    accentDarkColor={accentDarkColor}
  >
    <Shuffle color={active ? accentColor : inactiveColor} size={17} />
  </PressScale>
);

const PreviousControl: React.FC<{
  disabled: boolean;
  onPress: () => unknown | Promise<unknown>;
  color: string;
}> = ({ disabled, onPress, color }) => (
  <PressScale
    testID="controls-previous"
    accessibilityLabel="Vorheriger Titel"
    onPress={onPress}
    disabled={disabled}
  >
    <SkipBack color={color} size={20} fill={color} />
  </PressScale>
);

const PlayPauseControl: React.FC<AccentProps & {
  isPlaying: boolean;
  disabled: boolean;
  onPress: () => unknown | Promise<unknown>;
  onAccentColor: string;
}> = ({ isPlaying, disabled, onPress, accentColor, accentDarkColor, onAccentColor }) => (
  <PressScale
    testID="controls-play-pause"
    accessibilityLabel={isPlaying ? 'Pausieren' : 'Abspielen'}
    onPress={onPress}
    disabled={disabled}
    size={56}
    primary
    accentColor={accentColor}
    accentDarkColor={accentDarkColor}
  >
    {isPlaying
      ? <Pause color={onAccentColor} size={24} fill={onAccentColor} />
      : <Play color={onAccentColor} size={24} fill={onAccentColor} />}
  </PressScale>
);

const NextControl: React.FC<{
  disabled: boolean;
  onPress: () => unknown | Promise<unknown>;
  color: string;
}> = ({ disabled, onPress, color }) => (
  <PressScale
    testID="controls-next"
    accessibilityLabel="Nächster Titel"
    onPress={onPress}
    disabled={disabled}
  >
    <SkipForward color={color} size={20} fill={color} />
  </PressScale>
);

const RepeatControl: React.FC<AccentProps & {
  mode: RepeatMode;
  onPress: () => unknown | Promise<unknown>;
  inactiveColor: string;
}> = ({ mode, onPress, accentColor, accentDarkColor, inactiveColor }) => {
  const color = mode === 'off' ? inactiveColor : accentColor;
  const icon = mode === 'one'
    ? <Repeat1 color={color} size={17} />
    : <Repeat color={color} size={17} />;
  return (
    <PressScale
      testID="controls-repeat"
      accessibilityLabel={REPEAT_MODE_LABELS[mode]}
      onPress={onPress}
      size={36}
      active={mode !== 'off'}
      accentColor={accentColor}
      accentDarkColor={accentDarkColor}
    >
      {icon}
    </PressScale>
  );
};

interface ControlRailProps extends AccentProps {
  currentSong: Song | null;
  playbackQueue: Song[];
  repeatMode: RepeatMode;
  shuffle: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  onAccentColor: string;
  primaryTextColor: string;
  mutedTextColor: string;
  surfaceColor: string;
  borderColor: string;
  toggleShuffle: () => unknown | Promise<unknown>;
  previous: () => unknown | Promise<unknown>;
  togglePlayPause: () => unknown | Promise<unknown>;
  next: () => unknown | Promise<unknown>;
  cycleRepeatMode: () => unknown | Promise<unknown>;
}

const ControlRail: React.FC<ControlRailProps> = props => {
  const canSkipNext = canSkipToNextInQueue(props);
  return (
    <View
      style={[styles.controlRail, { backgroundColor: props.surfaceColor, borderColor: props.borderColor }]}
      testID="controls-rail"
    >
      <ShuffleControl
        active={props.shuffle}
        onPress={props.toggleShuffle}
        accentColor={props.accentColor}
        accentDarkColor={props.accentDarkColor}
        inactiveColor={props.mutedTextColor}
      />
      <PreviousControl disabled={!props.currentSong} onPress={props.previous} color={props.primaryTextColor} />
      <PlayPauseControl
        isPlaying={props.isPlaying}
        disabled={!props.currentSong || props.isBuffering}
        onPress={props.togglePlayPause}
        accentColor={props.accentColor}
        accentDarkColor={props.accentDarkColor}
        onAccentColor={props.onAccentColor}
      />
      <NextControl disabled={!canSkipNext} onPress={props.next} color={props.primaryTextColor} />
      <RepeatControl
        mode={props.repeatMode}
        onPress={props.cycleRepeatMode}
        accentColor={props.accentColor}
        accentDarkColor={props.accentDarkColor}
        inactiveColor={props.mutedTextColor}
      />
    </View>
  );
};

interface ControlsProps {
  accentColor?: string;
  accentDarkColor?: string;
  onAccentColor?: string;
}

const Controls: React.FC<ControlsProps> = ({ accentColor, accentDarkColor, onAccentColor }) => {
  const { theme } = useAppTheme();
  const music = useMusicContext();
  const colors = useMemo(() => ({
    accentColor: accentColor ?? theme.palette.primary,
    accentDarkColor: accentDarkColor ?? theme.palette.primaryDark,
    onAccentColor: onAccentColor ?? theme.palette.text.onPrimary,
  }), [accentColor, accentDarkColor, onAccentColor, theme.palette.primary,
    theme.palette.primaryDark, theme.palette.text.onPrimary]);
  const colorKey = `${colors.accentColor}|${colors.accentDarkColor}|${colors.onAccentColor}`;
  return (
    <View style={styles.container} testID="controls">
      <CrossfadeLayers value={colors} valueKey={colorKey} testID="controls-color-transition"
        renderLayer={layerColors => (
          <ControlRail
            currentSong={music.currentSong}
            playbackQueue={music.playbackQueue}
            repeatMode={music.repeatMode}
            shuffle={music.shuffle}
            isPlaying={music.isPlaying}
            isBuffering={music.isBuffering}
            accentColor={layerColors.accentColor}
            accentDarkColor={layerColors.accentDarkColor}
            onAccentColor={layerColors.onAccentColor}
            primaryTextColor={theme.palette.text.primary}
            mutedTextColor={theme.palette.text.muted}
            surfaceColor={theme.palette.surfaceGlass}
            borderColor={theme.palette.border}
            toggleShuffle={music.toggleShuffle}
            previous={music.previous}
            togglePlayPause={music.togglePlayPause}
            next={music.next}
            cycleRepeatMode={music.cycleRepeatMode}
          />
        )} />
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
