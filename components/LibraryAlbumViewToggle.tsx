import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Grid2X2, List } from 'lucide-react-native';
import { theme } from '../theme';

export type LibraryAlbumViewMode = 'grid' | 'list';

interface LibraryAlbumViewToggleProps {
  mode: LibraryAlbumViewMode;
  onToggle: () => void;
}

const LibraryAlbumViewToggle: React.FC<LibraryAlbumViewToggleProps> = ({ mode, onToggle }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel="Albumansicht wechseln"
    accessibilityHint={mode === 'grid' ? 'Wechselt zur Listenansicht' : 'Wechselt zur Rasteransicht'}
    onPress={onToggle}
    style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
    testID="library-album-view-toggle"
  >
    {mode === 'grid' ? <List color={theme.palette.text.secondary} size={16} /> : <Grid2X2 color={theme.palette.text.secondary} size={16} />}
  </Pressable>
);

const styles = StyleSheet.create({
  toggle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
});

export default LibraryAlbumViewToggle;
