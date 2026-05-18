import { useCallback, useEffect, useState } from 'react';
import { isFavoriteSongId, setFavoriteSongId } from '../utils/storage';

interface NowPlayingFavoriteState {
  favorite: boolean;
  favoritePending: boolean;
  toggleFavorite: () => void;
}

export const useNowPlayingFavorite = (songId?: string): NowPlayingFavoriteState => {
  const [favorite, setFavorite] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!songId) {
      setFavorite(false);
      setFavoritePending(false);
      return;
    }

    isFavoriteSongId(songId).then(value => {
      if (!cancelled) setFavorite(value);
    });

    return () => {
      cancelled = true;
    };
  }, [songId]);

  const toggleFavorite = useCallback(() => {
    if (!songId || favoritePending) return;

    const previous = favorite;
    const next = !favorite;
    setFavorite(next);
    setFavoritePending(true);

    void setFavoriteSongId(songId, next)
      .catch(() => {
        setFavorite(previous);
      })
      .finally(() => {
        setFavoritePending(false);
      });
  }, [favorite, favoritePending, songId]);

  return { favorite, favoritePending, toggleFavorite };
};
