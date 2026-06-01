import { useMemo, useRef } from 'react';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import type { AppStackParamList } from '../types/navigation';
import type { Song } from '../types/Song';

type TrackInfoRoute = RouteProp<AppStackParamList, 'TrackInfo'>;

export const useTrackInfoSong = () => {
  const route = useRoute<TrackInfoRoute>();
  const { songs, setSongs } = useLibraryMusicContext();
  const songsRef = useRef<Song[]>(songs);
  const songId = route.params.songId;

  songsRef.current = songs;

  const song = useMemo(
    () => songs.find(item => item.id === songId),
    [songId, songs],
  );

  return {
    song,
    songId,
    songsRef,
    setSongs,
  };
};
