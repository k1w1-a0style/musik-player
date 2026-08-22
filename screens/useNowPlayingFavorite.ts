import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isFavoriteSongId, normalizeStorageSongId, setFavoriteSongId } from '../utils/storage';
import { publishFavoriteSongIds } from '../utils/favoriteSongState';

interface NowPlayingFavoriteState {
  favorite: boolean;
  favoritePending: boolean;
  toggleFavorite: () => void;
}

export const useNowPlayingFavorite = (songId?: string): NowPlayingFavoriteState => {
  const normalizedSongId = useMemo(() => normalizeStorageSongId(songId), [songId]);
  const [favorite, setFavorite] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    let cancelled = false;

    setFavorite(false);
    setFavoritePending(false);

    if (!normalizedSongId) return () => {
      cancelled = true;
    };

    void isFavoriteSongId(normalizedSongId)
      .then(value => {
        if (!cancelled && requestVersionRef.current === requestVersion) setFavorite(value);
      })
      .catch(error => {
        if (!cancelled && requestVersionRef.current === requestVersion) {
          console.warn('[NowPlayingFavorite] Failed to load favorite state.', { songId: normalizedSongId, error });
          setFavorite(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedSongId]);

  const toggleFavorite = useCallback(() => {
    if (!normalizedSongId || favoritePending) return;

    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    const previous = favorite;
    const next = !favorite;
    setFavorite(next);
    setFavoritePending(true);

    void setFavoriteSongId(normalizedSongId, next)
      .then(publishFavoriteSongIds)
      .catch(error => {
        if (requestVersionRef.current === requestVersion) {
          console.warn('[NowPlayingFavorite] Failed to persist favorite state.', { songId: normalizedSongId, favorite: next, error });
          setFavorite(previous);
        }
      })
      .finally(() => {
        if (requestVersionRef.current === requestVersion) setFavoritePending(false);
      });
  }, [favorite, favoritePending, normalizedSongId]);

  return { favorite, favoritePending, toggleFavorite };
};
