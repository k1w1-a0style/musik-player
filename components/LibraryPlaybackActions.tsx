import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Heart, Play, Shuffle } from 'lucide-react-native';
import { theme } from '../theme';

interface LibraryPlaybackActionsProps {
  disabled: boolean;
  showFavoriteIcon?: boolean;
  onShuffle: () => void;
  onPlay: () => void;
}

const LibraryPlaybackActions: React.FC<LibraryPlaybackActionsProps> = ({
  disabled,
  showFavoriteIcon,
  onShuffle,
  onPlay,
}) => (
  <View style={styles.actions} testID="library-playback-actions">
    {showFavoriteIcon && <Heart color={theme.palette.primary} size={17} fill={theme.palette.primary} testID="library-favorites-indicator" />}
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Zufällig abspielen"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onShuffle}
      style={({ pressed }) => [styles.roundButton, pressed && styles.pressed, disabled && styles.disabled]}
      testID="library-shuffle-button"
    >
      <Shuffle color={theme.palette.text.primary} size={17} />
    </Pressable>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abspielen"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPlay}
      style={({ pressed }) => [styles.roundButton, pressed && styles.pressed, disabled && styles.disabled]}
      testID="library-play-button"
    >
      <Play color={theme.palette.text.primary} size={17} />
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundButton: { width: 36, height: 36, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});

export default LibraryPlaybackActions;
