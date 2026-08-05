import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Grid2X2, List } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import type { LibraryAlbumViewMode } from '../types/LibraryView';

interface LibraryAlbumViewToggleProps {
  mode: LibraryAlbumViewMode;
  onToggle: () => void;
}

const LibraryAlbumViewToggle: React.FC<LibraryAlbumViewToggleProps> = ({ mode, onToggle }) => {
  const { theme } = useAppTheme();
  const iconColor = theme.palette.text.secondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Albumansicht wechseln"
      accessibilityHint={mode === 'grid' ? 'Wechselt zur Listenansicht' : 'Wechselt zur Rasteransicht'}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.toggle,
        { backgroundColor: theme.palette.surfaceGlass, borderColor: theme.palette.border },
        pressed && styles.pressed,
      ]}
      testID="library-album-view-toggle"
    >
      {mode === 'grid' ? <List color={iconColor} size={16} /> : <Grid2X2 color={iconColor} size={16} />}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  toggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.72 },
});

export default LibraryAlbumViewToggle;
