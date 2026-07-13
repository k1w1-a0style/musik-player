import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { getNowPlayingMenuBackdropColor } from '../utils/appThemeOverlays';
import NowPlayingMenuItem from './NowPlayingMenuItem';
import { formatSleepTimerRemaining } from './useSleepTimer';

interface NowPlayingMenuModalProps {
  visible: boolean;
  favorite: boolean;
  onClose: () => void;
  onOpenTrackInfo: () => void;
  onOpenEqualizer: () => void;
  onToggleFavorite: () => void;
  onSaveQueueAsPlaylist: () => void;
  sleepTimerActive: boolean;
  sleepTimerRemainingSeconds?: number | null;
  onStartSleepTimer: (minutes: number) => void;
  onCancelSleepTimer: () => void;
}

const SLEEP_TIMER_OPTIONS_MINUTES = [1, 15, 30, 45, 60];

const NowPlayingMenuModal: React.FC<NowPlayingMenuModalProps> = ({
  visible,
  favorite,
  onClose,
  onOpenTrackInfo,
  onOpenEqualizer,
  onToggleFavorite,
  onSaveQueueAsPlaylist,
  sleepTimerActive,
  sleepTimerRemainingSeconds = null,
  onStartSleepTimer,
  onCancelSleepTimer,
}) => {
  const { appearance, theme } = useAppTheme();
  const formattedSleepTimer = sleepTimerActive
    ? formatSleepTimerRemaining(sleepTimerRemainingSeconds)
    : null;

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
        <ScrollView
          style={[
            styles.menuCard,
            {
              backgroundColor: theme.palette.surfaceElevated,
              borderColor: theme.palette.border,
            },
          ]}
          contentContainerStyle={styles.menuContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
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

          {formattedSleepTimer ? (
            <Text
              style={[styles.sleepTimerStatus, { color: theme.palette.text.primary }]}
              accessibilityRole="text"
            >
              {`Sleep-Timer aktiv · ${formattedSleepTimer}`}
            </Text>
          ) : null}

          {SLEEP_TIMER_OPTIONS_MINUTES.map(minutes => (
            <NowPlayingMenuItem
              key={minutes}
              label={`Sleep-Timer: ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}`}
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
          <NowPlayingMenuItem label="Menü schließen" onPress={onClose} />
        </ScrollView>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  menuBackdrop: {
    flex: 1,
    alignItems: 'flex-end',
    paddingTop: 54,
    paddingRight: 22,
    paddingBottom: 16,
  },
  menuCard: {
    width: 235,
    maxHeight: '100%',
    borderRadius: 20,
    borderWidth: 1,
  },
  menuContent: { paddingVertical: 8 },
  sleepTimerStatus: { paddingHorizontal: 16, paddingVertical: 10, fontSize: 13, fontWeight: '600' },
});

export default NowPlayingMenuModal;
