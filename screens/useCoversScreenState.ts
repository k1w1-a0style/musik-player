import { useMemo } from 'react';
import { useMusicContext } from '../contexts/MusicContext';
import { buildAlbumGroups } from './coversHelpers';

export const useCoversScreenState = () => {
  const { songs, playSong } = useMusicContext();
  const albums = useMemo(() => buildAlbumGroups(songs), [songs]);

  return {
    albums,
    playSong,
  };
};
