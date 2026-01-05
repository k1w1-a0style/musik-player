import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Song, Playlist, RepeatMode } from '../types';
import { parseMusicFile } from '../utils/musicParser';

interface MusicContextType {
  songs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  playlists: Playlist[];
  currentPlaylist: Playlist | null;
  favorites: number[];
  loadLibrary: () => Promise<void>;
  playSong: (song: Song) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  createPlaylist: (name: string, songs: Song[]) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  addToPlaylist: (playlistId: string, song: Song) => Promise<void>;
  removeFromPlaylist: (playlistId: string, songId: number) => Promise<void>;
  toggleFavorite: (songId: number) => Promise<void>;
  setCurrentPlaylist: (playlist: Playlist | null) => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1.0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffled, setIsShuffled] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playQueue, setPlayQueue] = useState<Song[]>([]);

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    loadStoredData();
    setupAudio();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const setupAudio = async () => {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
  };

  const loadStoredData = async () => {
    try {
      const [storedPlaylists, storedFavorites, storedRepeat, storedShuffle] = await Promise.all([
        AsyncStorage.getItem('playlists'),
        AsyncStorage.getItem('favorites'),
        AsyncStorage.getItem('repeatMode'),
        AsyncStorage.getItem('isShuffled'),
      ]);

      if (storedPlaylists) setPlaylists(JSON.parse(storedPlaylists));
      if (storedFavorites) setFavorites(JSON.parse(storedFavorites));
      if (storedRepeat) setRepeatMode(storedRepeat as RepeatMode);
      if (storedShuffle) setIsShuffled(JSON.parse(storedShuffle));
    } catch (error) {
      console.error('Fehler beim Laden gespeicherter Daten:', error);
    }
  };

  const loadLibrary = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('Keine Berechtigung für Medienbibliothek');
        return;
      }

      const media = await MediaLibrary.getAssetsAsync({
        mediaType: 'audio',
        first: 1000,
      });

      const parsedSongs = await Promise.all(
        media.assets.map(async (asset, index) => {
          const metadata = await parseMusicFile(asset.uri);
          return {
            id: index + 1,
            title: metadata.title || asset.filename,
            artist: metadata.artist || 'Unbekannter Künstler',
            album: metadata.album || 'Unbekanntes Album',
            uri: asset.uri,
            duration: asset.duration * 1000,
            cover: metadata.cover || `https://picsum.photos/400/400?random=${index}`,
          };
        })
      );

      setSongs(parsedSongs);
      setPlayQueue(parsedSongs);
    } catch (error) {
      console.error('Fehler beim Laden der Bibliothek:', error);
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setCurrentTime(status.positionMillis);
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        handleSongEnd();
      }
    }
  };

  const handleSongEnd = async () => {
    if (repeatMode === 'one') {
      await soundRef.current?.replayAsync();
    } else if (repeatMode === 'all' || currentIndex < playQueue.length - 1) {
      await playNext();
    } else {
      setIsPlaying(false);
    }
  };

  const playSong = async (song: Song) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: song.uri },
        { shouldPlay: true, volume },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setCurrentSong(song);
      setIsPlaying(true);

      const index = playQueue.findIndex(s => s.id === song.id);
      if (index !== -1) setCurrentIndex(index);
    } catch (error) {
      console.error('Fehler beim Abspielen:', error);
    }
  };

  const togglePlayPause = async () => {
    if (!soundRef.current) return;

    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  };

  const playNext = async () => {
    let nextIndex = currentIndex + 1;
    if (nextIndex >= playQueue.length) {
      nextIndex = repeatMode === 'all' ? 0 : currentIndex;
    }
    if (playQueue[nextIndex]) {
      await playSong(playQueue[nextIndex]);
      setCurrentIndex(nextIndex);
    }
  };

  const playPrevious = async () => {
    if (currentTime > 3000) {
      await soundRef.current?.setPositionAsync(0);
    } else {
      let prevIndex = currentIndex - 1;
      if (prevIndex < 0) {
        prevIndex = repeatMode === 'all' ? playQueue.length - 1 : 0;
      }
      if (playQueue[prevIndex]) {
        await playSong(playQueue[prevIndex]);
        setCurrentIndex(prevIndex);
      }
    }
  };

  const seekTo = async (position: number) => {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(position);
    }
  };

  const setVolume = async (newVolume: number) => {
    setVolumeState(newVolume);
    if (soundRef.current) {
      await soundRef.current.setVolumeAsync(newVolume);
    }
  };

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const currentModeIndex = modes.indexOf(repeatMode);
    const nextMode = modes[(currentModeIndex + 1) % modes.length];
    setRepeatMode(nextMode);
    AsyncStorage.setItem('repeatMode', nextMode);
  };

  const toggleShuffle = () => {
    const newShuffled = !isShuffled;
    setIsShuffled(newShuffled);
    AsyncStorage.setItem('isShuffled', JSON.stringify(newShuffled));

    if (newShuffled) {
      const shuffled = [...playQueue].sort(() => Math.random() - 0.5);
      setPlayQueue(shuffled);
    } else {
      setPlayQueue(songs);
    }
  };

  const createPlaylist = async (name: string, songsToAdd: Song[]) => {
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name,
      songs: songsToAdd,
      createdAt: new Date().toISOString(),
    };
    const updated = [...playlists, newPlaylist];
    setPlaylists(updated);
    await AsyncStorage.setItem('playlists', JSON.stringify(updated));
  };

  const deletePlaylist = async (id: string) => {
    const updated = playlists.filter(p => p.id !== id);
    setPlaylists(updated);
    await AsyncStorage.setItem('playlists', JSON.stringify(updated));
  };

  const addToPlaylist = async (playlistId: string, song: Song) => {
    const updated = playlists.map(p =>
      p.id === playlistId ? { ...p, songs: [...p.songs, song] } : p
    );
    setPlaylists(updated);
    await AsyncStorage.setItem('playlists', JSON.stringify(updated));
  };

  const removeFromPlaylist = async (playlistId: string, songId: number) => {
    const updated = playlists.map(p =>
      p.id === playlistId ? { ...p, songs: p.songs.filter(s => s.id !== songId) } : p
    );
    setPlaylists(updated);
    await AsyncStorage.setItem('playlists', JSON.stringify(updated));
  };

  const toggleFavorite = async (songId: number) => {
    const updated = favorites.includes(songId)
      ? favorites.filter(id => id !== songId)
      : [...favorites, songId];
    setFavorites(updated);
    await AsyncStorage.setItem('favorites', JSON.stringify(updated));
  };

  return (
    <MusicContext.Provider
      value={{
        songs,
        currentSong,
        isPlaying,
        currentTime,
        duration,
        volume,
        repeatMode,
        isShuffled,
        playlists,
        currentPlaylist,
        favorites,
        loadLibrary,
        playSong,
        togglePlayPause,
        playNext,
        playPrevious,
        seekTo,
        setVolume,
        toggleRepeat,
        toggleShuffle,
        createPlaylist,
        deletePlaylist,
        addToPlaylist,
        removeFromPlaylist,
        toggleFavorite,
        setCurrentPlaylist,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic muss innerhalb von MusicProvider verwendet werden');
  }
  return context;
};
