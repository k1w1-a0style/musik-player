import { useState, type Dispatch, type SetStateAction } from 'react';
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
  const [hydrationStatus, setHydrationStatus] = useState<'loading' | 'ready' | 'degraded'>('loading');
  const [hydrationRetryToken, setHydrationRetryToken] = useState(0);
  const [songs, setSongsState] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [playbackQueue, setPlaybackQueue] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [shuffle, setShuffle] = useState(false);

  return {
    hydrationStatus,
    setHydrationStatus,
    hydrationRetryToken,
    retryHydration: () => setHydrationRetryToken(value => value + 1),
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
