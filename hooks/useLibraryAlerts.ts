import { useCallback } from 'react';
import { Alert } from 'react-native';

export interface LibraryAlertCopy {
  title: string;
  message: string;
}

export interface UseLibraryAlertsResult {
  showAlert: (alert: LibraryAlertCopy) => void;
}

export const useLibraryAlerts = (): UseLibraryAlertsResult => {
  const showAlert = useCallback((alert: LibraryAlertCopy) => {
    Alert.alert(alert.title, alert.message);
  }, []);

  return { showAlert };
};
