import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

interface LibrarySectionHeaderProps {
  title: string;
  count?: string | number;
  children?: ReactNode;
}

const LibrarySectionHeader: React.FC<LibrarySectionHeaderProps> = ({ title, count, children }) => (
  <View style={styles.listHeader} testID="library-section-header">
    <Text style={styles.sortLabel}>{title}</Text>
    {children ? (
      <View style={styles.listHeaderActions}>{children}</View>
    ) : count !== undefined ? (
      <Text style={styles.folderCount}>{count}</Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  listHeader: { height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  sortLabel: { color: theme.palette.text.secondary, fontFamily: theme.fonts.heading, fontSize: 14 },
  folderCount: { color: theme.palette.text.muted, fontFamily: theme.fonts.body, fontSize: 12 },
  listHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

export default LibrarySectionHeader;
