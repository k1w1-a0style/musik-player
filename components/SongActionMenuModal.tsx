import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { getLibraryMenuBackdropColor } from '../utils/appThemeOverlays';
import NowPlayingMenuItem from '../screens/NowPlayingMenuItem';

interface SongActionMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenTrackInfo: () => void;
  onOpenPlaylistPicker: () => void;
}

const SongActionMenuModal: React.FC<SongActionMenuModalProps> = ({
  visible,
  onClose,
  onOpenTrackInfo,
  onOpenPlaylistPicker,
}) => {
  const { appearance, theme } = useAppTheme();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable
        style={[styles.menuBackdrop, { backgroundColor: getLibraryMenuBackdropColor(appearance) }]}
        onPress={onClose}
        accessible={false}
        testID="song-action-menu-backdrop"
      >
        <View
          style={[styles.menuCard, { backgroundColor: theme.palette.surfaceElevated, borderColor: theme.palette.border }]}
          testID="song-action-menu-card"
        >
          <NowPlayingMenuItem label="Titelinformationen öffnen" onPress={onOpenTrackInfo} />
          <NowPlayingMenuItem label="Zu Playlist hinzufügen" onPress={onOpenPlaylistPicker} />
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  menuBackdrop: { flex: 1, alignItems: 'flex-end', paddingTop: 54, paddingRight: 22 },
  menuCard: { width: 245, borderRadius: 20, paddingVertical: 8, borderWidth: 1 },
});

export default SongActionMenuModal;
