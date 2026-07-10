import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ScanFolder } from '../types/ScanFolder';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import { useAppTheme } from '../contexts/AppThemeContext';
import { displayFolderName } from '../utils/libraryPresentation';

interface LibraryFolderRowProps {
  folder: ScanFolder;
  onRemove: (folder: ScanFolder) => void | Promise<void>;
}

const LibraryFolderRow: React.FC<LibraryFolderRowProps> = ({ folder, onRemove }) => {
  const { theme } = useAppTheme();
  const folderName = displayFolderName(folder);

  return (
    <View
      style={[styles.folderRow, { borderBottomColor: theme.palette.border }]}
      testID={`library-folder-row-${folder.id}`}
    >
      <View style={styles.folderTextWrap}>
        <Text style={[styles.folderName, { color: theme.palette.text.primary }]} numberOfLines={1}>
          {folderName}
        </Text>
        <Text style={[styles.folderMeta, { color: theme.palette.text.muted }]} numberOfLines={2}>
          {folder.lastError ?? folder.uri}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Scan-Ordner ${folderName} entfernen`}
        onPress={() => void onRemove(folder)}
        style={({ pressed }) => [
          styles.removeFolderButton,
          {
            backgroundColor: theme.palette.surfaceGlass,
            borderColor: theme.palette.border,
          },
          pressed && styles.pressed,
        ]}
        testID={`remove-folder-${folder.id}`}
      >
        <Text style={[styles.removeFolderText, { color: theme.palette.text.secondary }]}>Entfernen</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  folderTextWrap: { flex: 1, minWidth: 0 },
  folderName: { fontFamily: staticTokens.fonts.heading, fontSize: 14 },
  folderMeta: { fontFamily: staticTokens.fonts.body, fontSize: 11, marginTop: 2 },
  removeFolderButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  removeFolderText: { fontFamily: staticTokens.fonts.body, fontSize: 12 },
  pressed: { opacity: 0.72 },
});

export default LibraryFolderRow;
