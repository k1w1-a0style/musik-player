import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import { useAppTheme } from '../contexts/AppThemeContext';

interface LibrarySectionHeaderProps {
  title: string;
  count?: string | number;
  children?: ReactNode;
}

const LibrarySectionHeader: React.FC<LibrarySectionHeaderProps> = ({ title, count, children }) => {
  const { theme } = useAppTheme();

  return (
    <View style={styles.listHeader} testID="library-section-header">
      <Text style={[styles.sortLabel, { color: theme.palette.text.secondary }]} testID="library-section-title">{title}</Text>
      {children ? (
        <View style={styles.listHeaderActions} testID="library-section-actions">{children}</View>
      ) : count !== undefined ? (
        <Text style={[styles.folderCount, { color: theme.palette.text.muted }]}>{count}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  listHeader: {
    minHeight: 48,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  sortLabel: { fontFamily: staticTokens.fonts.heading, fontSize: 14, flexShrink: 1, maxWidth: '100%' },
  folderCount: { fontFamily: staticTokens.fonts.body, fontSize: 12, flexShrink: 1, maxWidth: '100%' },
  listHeaderActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexShrink: 1,
    maxWidth: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
});

export default LibrarySectionHeader;
