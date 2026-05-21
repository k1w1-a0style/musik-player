import { useCallback, useEffect, useRef, useState } from 'react';
import { isFavoriteSongId, setFavoriteSongId } from '../utils/storage';

interface NowPlayingFavoriteState {
  favorite: boolean;
  favoritePending: boolean;
  toggleFavorite: () => void;
}

export const useNowPlayingFavorite = (songId?: string): NowPlayingFavoriteState => {
  const [favorite, setFavorite] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    let cancelled = false;

    setFavorite(false);
    setFavoritePending(false);

    if (!songId) return () => {
      cancelled = true;
    };

    isFavoriteSongId(songId).then(value => {
      if (!cancelled && requestVersionRef.current === requestVersion) setFavorite(value);
    });

    return () => {
      cancelled = true;
    };
  }, [songId]);

  const toggleFavorite = useCallback(() => {
    if (!songId || favoritePending) return;

    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    const previous = favorite;
    const next = !favorite;
    setFavorite(next);
    setFavoritePending(true);

    void setFavoriteSongId(songId, next)
      .catch(() => {
        if (requestVersionRef.current === requestVersion) setFavorite(previous);
      })
      .finally(() => {
        if (requestVersionRef.current === requestVersion) setFavoritePending(false);
      });
  }, [favorite, favoritePending, songId]);

  return { favorite, favoritePending, toggleFavorite };
};
