import { type RefObject } from 'react';
import { Alert } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { AppStackParamList } from '../types/navigation';
import { APP_STACK_ROUTES } from '../types/routes';
import type { Song } from '../types/Song';

interface UseTrackInfoActionsInput {
  song?: Song;
  songsRef: RefObject<Song[]>;
  setSongs: (songs: Song[]) => void;
}

export const useTrackInfoActions = ({
  song,
  songsRef,
  setSongs,
}: UseTrackInfoActionsInput) => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();

  const openTagEditor = (): void => {
    if (!song) return;
    navigation.navigate(APP_STACK_ROUTES.TAG_EDITOR, { songId: song.id });
  };

  const removeFromLibrary = (): void => {
    if (!song) return;

    Alert.alert(
      'Aus Bibliothek entfernen?',
      'Der Track wird nur aus der App-Bibliothek entfernt. Die Audiodatei auf deinem Gerät bleibt erhalten.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: () => {
            setSongs(songsRef.current.filter(item => item.id !== song.id));
            navigation.goBack();
          },
        },
      ],
    );
  };

  return {
    openTagEditor,
    removeFromLibrary,
  };
};
