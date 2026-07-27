import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Playlist, Song } from '../types/Song';

export interface MusicProviderState {
  hydrationStatus?: 'loading' | 'ready' | 'degraded';
  setHydrationStatus?: Dispatch<SetStateAction<'loading' | 'ready' | 'degraded'>>;
  hydrationRetryToken?: number;
  retryHydration?: () => void;
  isReady: boolean;
  setIsReady: Dispatch<SetStateAction<boolean>>;
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
  const [hydrationStatus, setHydrationStatusState] = useState<'loading' | 'ready' | 'degraded'>('loading');
  const [hydrationRetryToken, setHydrationRetryToken] = useState(0);
  const retryPendingRef = useRef(false);
  const setHydrationStatus = useCallback<Dispatch<SetStateAction<'loading' | 'ready' | 'degraded'>>>(next => {
    setHydrationStatusState(previous => {
      const value = typeof next === 'function' ? next(previous) : next;
      if (value !== 'loading') retryPendingRef.current = false;
      return value;
    });
  }, []);
  const retryHydration = useCallback(() => {
    if (hydrationStatus !== 'degraded' || retryPendingRef.current) return;
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
