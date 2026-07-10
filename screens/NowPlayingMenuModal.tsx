import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { getNowPlayingMenuBackdropColor } from '../utils/appThemeOverlays';
import NowPlayingMenuItem from './NowPlayingMenuItem';

interface NowPlayingMenuModalProps {
  visible: boolean;
  favorite: boolean;
  onClose: () => void;
  onOpenTrackInfo: () => void;
  onOpenEqualizer: () => void;
  onToggleFavorite: () => void;
  onSaveQueueAsPlaylist: () => void;
  sleepTimerActive: boolean;
  onStartSleepTimer: (minutes: number) => void;
  onCancelSleepTimer: () => void;
}

const NowPlayingMenuModal: React.FC<NowPlayingMenuModalProps> = ({
  visible,
  favorite,
  onClose,
  onOpenTrackInfo,
  onOpenEqualizer,
  onToggleFavorite,
  onSaveQueueAsPlaylist,
  sleepTimerActive,
  onStartSleepTimer,
  onCancelSleepTimer,
}) => {
  const { appearance, theme } = useAppTheme();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable
        style={[
          styles.menuBackdrop,
          { backgroundColor: getNowPlayingMenuBackdropColor(appearance) },
        ]}
        onPress={onClose}
        accessible={false}
        testID="now-playing-menu-backdrop"
      >
        <View
          style={[
            styles.menuCard,
            {
              backgroundColor: theme.palette.surfaceElevated,
              borderColor: theme.palette.border,
            },
          ]}
          testID="now-playing-menu-card"
        >
          <NowPlayingMenuItem label="Titelinformationen öffnen" onPress={onOpenTrackInfo} />
          <NowPlayingMenuItem label="Equalizer öffnen" onPress={onOpenEqualizer} />
          <NowPlayingMenuItem
            label="Warteschlange speichern"
            onPress={() => {
              onSaveQueueAsPlaylist();
              onClose();
            }}
          />

          {[15, 30, 45, 60].map(minutes => (
            <NowPlayingMenuItem
              key={minutes}
              label={`Sleep-Timer: ${minutes} Minuten`}
              onPress={() => {
                onStartSleepTimer(minutes);
                onClose();
              }}
            />
          ))}
          {sleepTimerActive ? (
            <NowPlayingMenuItem
              label="Sleep-Timer abbrechen"
              onPress={() => {
                onCancelSleepTimer();
                onClose();
              }}
            />
          ) : null}
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
};

const styles = StyleSheet.create({
  menuBackdrop: { flex: 1, alignItems: 'flex-end', paddingTop: 54, paddingRight: 22 },
  menuCard: { width: 235, borderRadius: 20, paddingVertical: 8, borderWidth: 1 },
});

export default NowPlayingMenuModal;
