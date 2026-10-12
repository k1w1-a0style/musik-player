import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { Song } from '../types/Song';
import { uniqueCleanerSongs } from '../utils/tagCleanerSelection';
import { useAppTheme } from '../contexts/AppThemeContext';
const PlaylistCleanerButton: React.FC<{ songs: readonly Song[]; onOpen: (ids: string[]) => void }> = ({ songs, onOpen }) => {
  const { theme } = useAppTheme(); const unique = uniqueCleanerSongs(songs);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Tags von ${unique.length} Playlist-Titeln bereinigen`}
    accessibilityState={{ disabled: !unique.length }} disabled={!unique.length}
    onPress={() => onOpen(unique.map(song => song.id))} testID="playlist-detail-cleaner-button"
    style={[styles.button, { borderColor: theme.palette.border, backgroundColor: theme.palette.surface }]}>
    <Text style={{ color: theme.palette.text.primary }}>Tags bereinigen ({unique.length})</Text>
  </Pressable>;
};
const styles = StyleSheet.create({ button: { minHeight: 48, maxWidth: '100%', flexShrink: 1, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth,
  borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 } });
export default PlaylistCleanerButton;
