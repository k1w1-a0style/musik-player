import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createAudioPlayer, type AudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { Song } from '../types/Song';

interface MusicContextValue {
  songs: Song[];
  setSongs: (s: Song[]) => void;
  currentSong: Song | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  playSong: (song: Song) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  stop: () => Promise<void>;
  seekTo: (millis: number) => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
}

const MusicContext = createContext<MusicContextValue | null>(null);

export const MusicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const playerRef = useRef<AudioPlayer | null>(null);
  const [songs, setSongsState] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(
      () => undefined,
    );
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const status = p.currentStatus;
      if (!status) return;
      setPosition((status.currentTime ?? 0) * 1000);
      setDuration((status.duration ?? 0) * 1000);
      setIsPlaying(!!status.playing);
    }, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, []);

  const playSong = useCallback(async (song: Song) => {
    if (!song.uri) return;
    playerRef.current?.remove();
    const p = createAudioPlayer({ uri: song.uri });
    playerRef.current = p;
    setCurrentSong(song);
    p.play();
    setIsPlaying(true);
  }, []);

  const togglePlayPause = useCallback(async () => {
    const p = playerRef.current;
    if (!p) return;
    if (p.playing) {
      p.pause();
      setIsPlaying(false);
    } else {
      p.play();
      setIsPlaying(true);
    }
  }, []);

  const stop = useCallback(async () => {
    const p = playerRef.current;
    if (!p) return;
    p.pause();
    await p.seekTo(0);
    setIsPlaying(false);
    setPosition(0);
  }, []);

  const seekTo = useCallback(async (millis: number) => {
    const p = playerRef.current;
    if (!p) return;
    await p.seekTo(millis / 1000);
    setPosition(millis);
  }, []);

  const getIndex = useCallback(() => {
    if (!currentSong) return -1;
    return songs.findIndex(s => s.id === currentSong.id);
  }, [songs, currentSong]);

  const next = useCallback(async () => {
    if (songs.length === 0) return;
    const i = getIndex();
    const nextIdx = (i + 1) % songs.length;
    await playSong(songs[nextIdx]);
  }, [songs, getIndex, playSong]);

  const previous = useCallback(async () => {
    if (songs.length === 0) return;
    const i = getIndex();
    const prevIdx = (i - 1 + songs.length) % songs.length;
    await playSong(songs[prevIdx]);
  }, [songs, getIndex, playSong]);

  const setSongs = useCallback((s: Song[]) => setSongsState(s), []);

  const value = useMemo<MusicContextValue>(
    () => ({
      songs,
      setSongs,
      currentSong,
      isPlaying,
      position,
      duration,
      playSong,
      togglePlayPause,
      stop,
      seekTo,
      next,
      previous,
    }),
    [
      songs,
      setSongs,
      currentSong,
      isPlaying,
      position,
      duration,
      playSong,
      togglePlayPause,
      stop,
      seekTo,
      next,
      previous,
    ],
  );

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
};

export const useMusicContext = (): MusicContextValue => {
  const ctx = useContext(MusicContext);
  if (!ctx) {
    throw new Error('useMusicContext must be used within a MusicProvider');
  }
  return ctx;
};
