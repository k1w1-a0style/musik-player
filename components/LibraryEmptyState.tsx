import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Disc3, Folder, ListMusic, Mic2, Music2, Star, Tags } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import type { LibraryTab } from '../utils/libraryTabs';

type LibraryEmptyIcon = React.ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

interface LibraryEmptyStateProps {
  activeTab: LibraryTab;
  message: string;
}

const EMPTY_ICONS: Record<LibraryTab, LibraryEmptyIcon> = {
  albums: Disc3,
  artists: Mic2,
  favorites: Star,
  folders: Folder,
  genres: Tags,
  playlists: ListMusic,
  tracks: Music2,
};

const LibraryEmptyState: React.FC<LibraryEmptyStateProps> = ({ activeTab, message }) => {
  const { theme } = useAppTheme();
  const Icon = EMPTY_ICONS[activeTab];

  return (
    <View style={styles.wrap} testID={`library-empty-state-${activeTab}`}>
      <Icon color={theme.palette.text.muted} size={28} strokeWidth={1.5} />
      <Text style={[styles.message, { color: theme.palette.text.muted }]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: staticTokens.spacing.sm,
    paddingHorizontal: staticTokens.spacing.lg,
    paddingVertical: staticTokens.spacing.xl,
  },
  message: {
    fontFamily: staticTokens.fonts.body,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});

export default LibraryEmptyState;
