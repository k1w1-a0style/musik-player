import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import type { AlertButton } from 'react-native';

export interface LibraryAlertCopy {
  title: string;
  message: string;
  buttons?: AlertButton[];
}

export const musicAccessButtons = (onSelectMusicFolder?: () => void): AlertButton[] => [
  { text: 'Später', style: 'cancel' },
  ...(onSelectMusicFolder ? [{ text: 'Musikordner auswählen', onPress: onSelectMusicFolder }] : []),
  { text: 'App-Einstellungen', onPress: () => {
    void Linking.openSettings().catch(() => Alert.alert('Einstellungen öffnen',
      'Öffne die Android-Einstellungen für k1w1-Musik und erlaube den Zugriff auf Musik und Audio. Alternativ kannst du einen Musikordner auswählen.'));
  } },
];

export interface UseLibraryAlertsResult {
  showAlert: (alert: LibraryAlertCopy) => void;
}

export const useLibraryAlerts = (): UseLibraryAlertsResult => {
  const showAlert = useCallback((alert: LibraryAlertCopy) => {
    if (alert.buttons) Alert.alert(alert.title, alert.message, alert.buttons);
    else Alert.alert(alert.title, alert.message);
  }, []);

  return { showAlert };
};
