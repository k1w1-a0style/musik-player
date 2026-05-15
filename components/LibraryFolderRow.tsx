import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ScanFolder } from '../types/ScanFolder';
import { theme } from '../theme';
import { displayFolderName } from '../utils/libraryPresentation';

interface LibraryFolderRowProps {
  folder: ScanFolder;
  onRemove: (folder: ScanFolder) => void | Promise<void>;
}

const LibraryFolderRow: React.FC<LibraryFolderRowProps> = ({ folder, onRemove }) => {
  const folderName = displayFolderName(folder);

  return (
    <View style={styles.folderRow} testID={`library-folder-row-${folder.id}`}>
      <View style={styles.folderTextWrap}>
        <Text style={styles.folderName} numberOfLines={1}>{folderName}</Text>
        <Text style={styles.folderMeta} numberOfLines={2}>{folder.lastError ?? folder.uri}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Scan-Ordner ${folderName} entfernen`}
        onPress={() => void onRemove(folder)}
        style={({ pressed }) => [styles.removeFolderButton, pressed && styles.pressed]}
        testID={`remove-folder-${folder.id}`}
      >
        <Text style={styles.removeFolderText}>Entfernen</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  folderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.palette.border },
  folderTextWrap: { flex: 1, minWidth: 0 },
  folderName: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 14 },
  folderMeta: { color: theme.palette.text.muted, fontFamily: theme.fonts.body, fontSize: 11, marginTop: 2 },
  removeFolderButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)' },
  removeFolderText: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12 },
  pressed: { opacity: 0.72 },
});

export default LibraryFolderRow;
