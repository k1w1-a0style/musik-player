import { useCallback } from 'react';
import { Alert } from 'react-native';

interface LibraryAlertCopy {
  title: string;
  message: string;
}

export const useLibraryAlerts = () => {
  const showAlert = useCallback((alert: LibraryAlertCopy) => {
    Alert.alert(alert.title, alert.message);
  }, []);

  return { showAlert };
};
