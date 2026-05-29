import { Alert } from 'react-native';

export const confirmLibraryImport = (found: number, skipped: number): Promise<boolean> =>
  new Promise(resolve => {
    Alert.alert(
      'Musik importieren',
      `${found} Musikdateien gefunden. ${skipped} kurze Audios, Sprachnachrichten oder Systemtöne wurden übersprungen.`,
      [
        { text: 'Abbrechen', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Importieren', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
