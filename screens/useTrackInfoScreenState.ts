import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import type { AppStackParamList } from '../types/navigation';
import { APP_STACK_ROUTES } from '../types/routes';
import {
  formatImportedAt,
  getTrackInfoCoverStatus,
  getTrackInfoCoverUri,
} from './trackInfoHelpers';

type TrackInfoRoute = RouteProp<AppStackParamList, 'TrackInfo'>;

export const useTrackInfoScreenState = () => {
  const route = useRoute<TrackInfoRoute>();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { songs, setSongs } = useLibraryMusicContext();
  const songsRef = useRef(songs);
  const [coverFailed, setCoverFailed] = useState(false);

  songsRef.current = songs;

  const song = useMemo(
    () => songs.find(item => item.id === route.params.songId),
    [route.params.songId, songs],
  );

  useEffect(() => {
    setCoverFailed(false);
  }, [song?.id, song?.cover]);

  const coverUri = song ? getTrackInfoCoverUri(song) : undefined;
  const coverStatus = song ? getTrackInfoCoverStatus(song, coverUri) : 'none';
  const importedAt = song ? formatImportedAt(song.fileInfo?.importedAt) : 'Nicht verfügbar';

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
    song,
    coverUri,
    coverStatus,
    importedAt,
    coverFailed,
    setCoverFailed,
    openTagEditor,
    removeFromLibrary,
  };
};
