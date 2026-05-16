import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';
import { libraryImportMessages } from '../utils/libraryImportMessages';

interface LibraryImportStatusProps {
  status?: string | null;
}

const LibraryImportStatus: React.FC<LibraryImportStatusProps> = ({ status }) => (
  <View style={styles.importStatusRow} testID="library-import-status">
    <ActivityIndicator color={theme.palette.primary} size="small" />
    <Text style={styles.importStatusText}>{status ?? libraryImportMessages.importRunning}</Text>
  </View>
);

const styles = StyleSheet.create({
  importStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.075)' },
  importStatusText: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12, flex: 1 },
});

export default LibraryImportStatus;
