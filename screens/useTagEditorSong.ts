import { useMemo, useRef } from 'react';
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { AppStackParamList } from '../types/navigation';
import type { Song } from '../types/Song';

type TagEditorRoute = RouteProp<AppStackParamList, 'TagEditor'>;

export const useTagEditorSong = (songs: Song[]) => {
  const route = useRoute<TagEditorRoute>();
  const song = useMemo(
    () => songs.find(item => item.id === route.params.songId),
    [songs, route.params.songId],
  );
  const activeSongId = song?.id ?? null;
  const activeSongRef = useRef<Song | undefined>(song);

  activeSongRef.current = song;

  return { song, activeSongId, activeSongRef };
};
