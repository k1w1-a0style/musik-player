import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme as staticTheme } from '../theme';
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
      <Text style={[styles.sortLabel, { color: theme.palette.text.secondary }]}>{title}</Text>
      {children ? (
        <View style={styles.listHeaderActions}>{children}</View>
      ) : count !== undefined ? (
        <Text style={[styles.folderCount, { color: theme.palette.text.muted }]}>{count}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  listHeader: { height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  sortLabel: { fontFamily: staticTheme.fonts.heading, fontSize: 14 },
  folderCount: { fontFamily: staticTheme.fonts.body, fontSize: 12 },
  listHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

export default LibrarySectionHeader;
