import React from 'react';
import { Modal, Pressable, StyleSheet, View, ScrollView, useWindowDimensions } from 'react-native';
import { FolderPlus, ListMusic, Settings, SlidersHorizontal } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { getLibraryMenuBackdropColor } from '../utils/appThemeOverlays';
import { useLibrarySelection } from '../contexts/LibrarySelectionContext';
import LibraryMenuItem from './LibraryMenuItem';
import LibraryScanSourceActions from './LibraryScanSourceActions';
import type { LibraryScanRequest } from '../utils/libraryScanSources';

export interface LibraryMenuModalProps {
  visible: boolean;
  loading: boolean;
  isReady: boolean;
  hasSongs: boolean;
  activeFolders: number;
  canResumeRefresh?: boolean;
  onClose: () => void;
  onImport: (options?: LibraryScanRequest) => void;
  onDeepScan?: (options?: LibraryScanRequest) => void;
  onOpenCleaner?: () => void;
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
  onOpenCleaner,
  onAddFolder,
  onShowFolders,
  onOpenSettings,
  onOpenEqualizer,
}) => {
  const { theme, appearance } = useAppTheme();
  const selection = useLibrarySelection();
  const { height } = useWindowDimensions();

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
          <ScrollView style={[styles.menuScroll, { maxHeight: Math.max(48, height - 80) }]} contentContainerStyle={styles.menuContent}>
          {selection ? <LibraryMenuItem icon={ListMusic} label="Auswählen" onPress={() => { selection.store.start(); onClose(); }} /> : null}
          {onOpenCleaner&&<LibraryMenuItem icon={SlidersHorizontal} label="Sammlung aufräumen" description="Musik und Felder auswählen, Änderungen zuerst prüfen." onPress={onOpenCleaner} disabled={loading||!isReady}/>}
          {visible ? <LibraryScanSourceActions disabled={loading || !isReady} activeFolders={activeFolders}
            onImport={onImport} onDeepScan={onDeepScan} /> : null}
          <LibraryMenuItem icon={FolderPlus} label="Ordner hinzufügen" onPress={onAddFolder} disabled={loading || !isReady} />
          <LibraryMenuItem icon={ListMusic} label={`Aktive Scan-Ordner: ${activeFolders}`} onPress={onShowFolders} muted />
          <View style={[styles.divider, { backgroundColor: theme.palette.border }]} testID="library-menu-section-divider" />
          <LibraryMenuItem icon={SlidersHorizontal} label="Equalizer" onPress={onOpenEqualizer} />
          <LibraryMenuItem icon={Settings} label="Einstellungen" onPress={onOpenSettings} />
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  menuBackdrop: { flex: 1, alignItems: 'flex-end', paddingTop: 54, paddingRight: 24 },
  menuCard: {
    width: 280,
    maxWidth: '100%',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  menuScroll: { maxHeight: 480 },
  menuContent: { paddingBottom: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6, marginHorizontal: 16 },
});

export default LibraryMenuModal;
