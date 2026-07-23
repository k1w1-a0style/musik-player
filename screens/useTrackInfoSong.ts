import { useMemo, useRef } from 'react';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import type { AppStackParamList } from '../types/navigation';
import type { Song } from '../types/Song';

type TrackInfoRoute = RouteProp<AppStackParamList, 'TrackInfo'>;

export const useTrackInfoSong = () => {
  const route = useRoute<TrackInfoRoute>();
  const { songs, setSongs, isReady } = useLibraryMusicContext();
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
    // Production always provides this boolean. Defaulting missing test doubles to
    // ready keeps older focused component tests compatible without weakening the
    // real hydration gate (`false` remains false).
    isReady: isReady ?? true,
  };
};
