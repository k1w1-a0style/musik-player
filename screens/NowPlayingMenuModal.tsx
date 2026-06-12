import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { theme } from '../theme';
import NowPlayingMenuItem from './NowPlayingMenuItem';

interface NowPlayingMenuModalProps {
  visible: boolean;
  favorite: boolean;
  onClose: () => void;
  onOpenTrackInfo: () => void;
  onToggleFavorite: () => void;
  onSaveQueueAsPlaylist: () => void;
}

const NowPlayingMenuModal: React.FC<NowPlayingMenuModalProps> = ({
  visible,
  favorite,
  onClose,
  onOpenTrackInfo,
  onToggleFavorite,
  onSaveQueueAsPlaylist,
}) => (
  <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
    <Pressable
      style={styles.menuBackdrop}
      onPress={onClose}
      accessible={false}
      testID="now-playing-menu-backdrop"
    >
      <View style={styles.menuCard}>
        <NowPlayingMenuItem label="Titelinformationen öffnen" onPress={onOpenTrackInfo} />
        <NowPlayingMenuItem
          label="Warteschlange speichern"
          onPress={() => {
            onSaveQueueAsPlaylist();
            onClose();
          }}
        />
        <NowPlayingMenuItem
          label={favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
          onPress={() => {
            onToggleFavorite();
            onClose();
          }}
        />
      </View>
    </Pressable>
  </Modal>
);

const styles = StyleSheet.create({
  menuBackdrop: { flex: 1, alignItems: 'flex-end', paddingTop: 54, paddingRight: 22, backgroundColor: 'rgba(0,0,0,0.20)' },
  menuCard: { width: 235, borderRadius: 20, backgroundColor: theme.palette.surfaceElevated, paddingVertical: 8, borderWidth: 1, borderColor: theme.palette.border },
});

export default NowPlayingMenuModal;
