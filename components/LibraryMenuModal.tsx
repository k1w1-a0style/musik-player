import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { FolderPlus, ListMusic, Music, Settings, SlidersHorizontal } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { getLibraryMenuBackdropColor } from '../utils/appThemeOverlays';
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
  onDeepScan?: () => void;
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
  activeFolders,
  onClose,
  onImport,
  onDeepScan,
  onAddFolder,
  onShowFolders,
  onOpenSettings,
  onOpenEqualizer,
}) => {
  const { theme, appearance } = useAppTheme();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable
        style={[styles.menuBackdrop, { backgroundColor: getLibraryMenuBackdropColor(appearance) }]}
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
          <LibraryMenuItem icon={Music} label="Schnellscan / Import" description="Neue oder geänderte Dateien einlesen."
            onPress={onImport} disabled={loading || !isReady} />
          {onDeepScan ? <LibraryMenuItem icon={Music} label="Vollständiger Scan" description="Alle Dateien und ihren Inhalt erneut prüfen."
            onPress={onDeepScan} disabled={loading || !isReady} /> : null}
          <LibraryMenuItem icon={FolderPlus} label="Ordner hinzufügen" onPress={onAddFolder} disabled={loading || !isReady} />
          <LibraryMenuItem icon={ListMusic} label={`Aktive Scan-Ordner: ${activeFolders}`} onPress={onShowFolders} muted />
          <View style={[styles.divider, { backgroundColor: theme.palette.border }]} testID="library-menu-section-divider" />
          <LibraryMenuItem icon={SlidersHorizontal} label="Equalizer" onPress={onOpenEqualizer} />
          <LibraryMenuItem icon={Settings} label="Einstellungen" onPress={onOpenSettings} />
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
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6, marginHorizontal: 16 },
});

export default LibraryMenuModal;
