import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { theme } from '../theme';
import LibraryMenuItem from './LibraryMenuItem';

export interface LibraryMenuModalProps {
  visible: boolean;
  loading: boolean;
  isReady: boolean;
  hasSongs: boolean;
  activeFolders: number;
  onClose: () => void;
  onImport: () => void;
  onRefreshMetadata: () => void;
  onAddFolder: () => void;
  onShowFolders: () => void;
  onOpenSettings: () => void;
}

const LibraryMenuModal: React.FC<LibraryMenuModalProps> = ({
  visible,
  loading,
  isReady,
  hasSongs,
  activeFolders,
  onClose,
  onImport,
  onRefreshMetadata,
  onAddFolder,
  onShowFolders,
  onOpenSettings,
}) => (
  <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
    <Pressable style={styles.menuBackdrop} onPress={onClose} testID="library-menu-backdrop">
      <View style={styles.menuCard} testID="library-menu-card">
        <LibraryMenuItem label="Importieren / Rescan" onPress={onImport} disabled={loading || !isReady} />
        <LibraryMenuItem label="Metadaten aktualisieren" onPress={onRefreshMetadata} disabled={loading || !isReady || !hasSongs} />
        <LibraryMenuItem label="Ordner hinzufügen" onPress={onAddFolder} />
        <LibraryMenuItem label={`Aktive Scan-Ordner: ${activeFolders}`} onPress={onShowFolders} muted />
        <LibraryMenuItem label="Einstellungen" onPress={onOpenSettings} />
      </View>
    </Pressable>
  </Modal>
);

const styles = StyleSheet.create({
  menuBackdrop: { flex: 1, alignItems: 'flex-end', paddingTop: 54, paddingRight: 24, backgroundColor: 'rgba(0,0,0,0.10)' },
  menuCard: { width: 250, borderRadius: 22, backgroundColor: theme.palette.surfaceElevated, paddingVertical: 10, shadowColor: theme.palette.backgroundDeep, shadowOpacity: 0.35, shadowRadius: 18, elevation: 10 },
});

export default LibraryMenuModal;
