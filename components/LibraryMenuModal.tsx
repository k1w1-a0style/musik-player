import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import LibraryMenuItem from './LibraryMenuItem';

export interface LibraryMenuModalProps {
  visible: boolean;
  loading: boolean;
  isReady: boolean;
  hasSongs: boolean;
  activeFolders: number;
  canResumeRefresh?: boolean;
  onClose: () => void;
  onImport: () => void;
  onRefreshMetadata: () => void;
  onAddFolder: () => void;
  onShowFolders: () => void;
  onOpenSettings: () => void;
  onOpenEqualizer: () => void;
}

const LibraryMenuModal: React.FC<LibraryMenuModalProps> = ({
  visible,
  loading,
  isReady,
  hasSongs,
  activeFolders,
  canResumeRefresh,
  onClose,
  onImport,
  onRefreshMetadata,
  onAddFolder,
  onShowFolders,
  onOpenSettings,
  onOpenEqualizer,
}) => {
  const { theme, appearance } = useAppTheme();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable
        style={[styles.menuBackdrop, { backgroundColor: appearance === 'light' ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.22)' }]}
        onPress={onClose}
        accessible={false}
        testID="library-menu-backdrop"
      >
        <View
          style={[
            styles.menuCard,
            {
              backgroundColor: theme.palette.surfaceElevated,
              borderColor: theme.palette.border,
              shadowColor: theme.palette.backgroundDeep,
            },
          ]}
          testID="library-menu-card"
        >
          <LibraryMenuItem label="Importieren / Rescan" onPress={onImport} disabled={loading || !isReady} />
          <LibraryMenuItem
            label={canResumeRefresh ? 'Metadaten-Update fortsetzen' : 'Metadaten aktualisieren'}
            onPress={onRefreshMetadata}
            disabled={loading || !isReady || !hasSongs}
          />
          <LibraryMenuItem label="Ordner hinzufügen" onPress={onAddFolder} />
          <LibraryMenuItem label={`Aktive Scan-Ordner: ${activeFolders}`} onPress={onShowFolders} muted />
          <LibraryMenuItem label="Equalizer" onPress={onOpenEqualizer} />
          <LibraryMenuItem label="Einstellungen" onPress={onOpenSettings} />
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  menuBackdrop: { flex: 1, alignItems: 'flex-end', paddingTop: 54, paddingRight: 24 },
  menuCard: {
    width: 250,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
});

export default LibraryMenuModal;
