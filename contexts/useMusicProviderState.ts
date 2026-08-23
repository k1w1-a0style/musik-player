import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Playlist, Song } from '../types/Song';

export interface MusicProviderState {
  hydrationStatus?: 'loading' | 'ready' | 'degraded' | 'retry-required';
  setHydrationStatus?: Dispatch<SetStateAction<'loading' | 'ready' | 'degraded' | 'retry-required'>>;
  hydrationRetryToken?: number;
  retryHydration?: () => void;
  isReady: boolean;
  setIsReady: Dispatch<SetStateAction<boolean>>;
  libraryHydrationReady: boolean;
  setLibraryHydrationReady: Dispatch<SetStateAction<boolean>>;
  songs: Song[];
  setSongsState: Dispatch<SetStateAction<Song[]>>;
  currentSong: Song | null;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  playbackQueue: Song[];
  setPlaybackQueue: Dispatch<SetStateAction<Song[]>>;
  playlists: Playlist[];
  setPlaylists: Dispatch<SetStateAction<Playlist[]>>;
  shuffle: boolean;
  setShuffle: Dispatch<SetStateAction<boolean>>;
}

export const useMusicProviderState = (): MusicProviderState => {
  const [isReady, setIsReady] = useState(false);
  const [libraryHydrationReady, setLibraryHydrationReady] = useState(false);
  const [hydrationStatus, setHydrationStatusState] = useState<'loading' | 'ready' | 'degraded' | 'retry-required'>('loading');
  const [hydrationRetryToken, setHydrationRetryToken] = useState(0);
  const retryPendingRef = useRef(false);
  const setHydrationStatus = useCallback<Dispatch<SetStateAction<'loading' | 'ready' | 'degraded' | 'retry-required'>>>(next => {
    setHydrationStatusState(previous => {
      const value = typeof next === 'function' ? next(previous) : next;
      if (value !== 'loading') retryPendingRef.current = false;
      return value;
    });
  }, []);
  const retryHydration = useCallback(() => {
    if ((hydrationStatus !== 'degraded' && hydrationStatus !== 'retry-required') || retryPendingRef.current) return;
    retryPendingRef.current = true;
    setHydrationRetryToken(value => value + 1);
  }, [hydrationStatus]);
  const [songs, setSongsState] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [playbackQueue, setPlaybackQueue] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [shuffle, setShuffle] = useState(false);

  return {
    hydrationStatus,
    setHydrationStatus,
    hydrationRetryToken,
    retryHydration,
    isReady,
    setIsReady,
    libraryHydrationReady,
    setLibraryHydrationReady,
    songs,
    setSongsState,
    currentSong,
    setCurrentSong,
    playbackQueue,
    setPlaybackQueue,
    playlists,
    setPlaylists,
    shuffle,
    setShuffle,
  };
};
