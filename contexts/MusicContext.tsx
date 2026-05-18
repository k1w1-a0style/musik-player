import React, {
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import TrackPlayer from 'react-native-track-player';
import {
  type Playlist,
  type Song,
} from '../types/Song';
import { StorageKeys, storage } from '../utils/storage';
import { prunePlaylists } from '../utils/playlistState';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';
import { createRequiredContextHook } from './createRequiredContextHook';
import {
  buildLibraryMusicContextValue,
  buildMiniPlayerMusicContextValue,
  buildMusicContextValue,
  buildNowPlayingMusicContextValue,
} from './musicContextValues';
import type {
  LibraryMusicContextValue,
  MiniPlayerMusicContextValue,
  MusicContextValue,
  NowPlayingMusicContextValue,
} from './musicContextTypes';
import { useAlbumPalette } from './useAlbumPalette';
import { useAudioVisualizer } from './useAudioVisualizer';
import { useCurrentSongSync } from './useCurrentSongSync';
import { useEqualizerControls } from './useEqualizerControls';
import { useMusicHydration } from './useMusicHydration';
import { useMusicPersistence } from './useMusicPersistence';
import { useNativeEqualizer } from './useNativeEqualizer';
import { usePlaybackControls } from './usePlaybackControls';
import { usePlaybackQueueActions } from './usePlaybackQueueActions';
import { usePlaylistActions } from './usePlaylistActions';

const MusicContext = createContext<MusicContextValue | null>(null);
const LibraryMusicContext = createContext<LibraryMusicContextValue | null>(null);
const MiniPlayerMusicContext = createContext<MiniPlayerMusicContextValue | null>(null);
const NowPlayingMusicContext = createContext<NowPlayingMusicContextValue | null>(null);

export const MusicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);

  const [songs, setSongsState] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [playbackQueue, setPlaybackQueue] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const [shuffle, setShuffle] = useState(false);
  const {
    isPlaying,
    isBuffering,
    repeatMode,
    setRepeatMode,
    cycleRepeatMode,
    volume,
    setVolumeState,
    setVolume,
    togglePlayPause,
    stop,
    seekTo,
    next,
    previous,
  } = usePlaybackControls();

  const {
    eqEnabled,
    setEqEnabled,
    setEqEnabledState,
    eqBands,
    setEqBand,
    setEqBandsState,
    eqPreset,
    applyEqPreset,
    setEqPreset,
  } = useEqualizerControls();
  const eqNative = useNativeEqualizer(eqEnabled, eqBands);
  const palette = useAlbumPalette(currentSong);

  const songsRef = useRef(songs);
  songsRef.current = songs;
  const queueContextRef = useRef<Song[]>([]);
  const baseQueueContextRef = useRef<Song[]>([]);
  const nativeQueueRef = useRef<Song[]>([]);

  const persistCurrentSongId = useCallback(async (song: Song | null): Promise<void> => {
    if (!song || !songsRef.current.some(item => item.id === song.id)) {
      await storage.remove(StorageKeys.CURRENT_SONG_ID);
      return;
    }
    await storage.set(StorageKeys.CURRENT_SONG_ID, song.id);
  }, []);

  const { fftBins, visualizerRunning, visualizerError } = useAudioVisualizer(isPlaying);

  // ---- Setup + Hydration ----
  useMusicHydration({
    songsRef,
    queueContextRef,
    baseQueueContextRef,
    nativeQueueRef,
    setIsReady,
    setSongsState,
    setCurrentSong,
    setPlaybackQueue,
    setPlaylists,
    setEqEnabledState,
    setEqBandsState,
    setEqPreset,
    setVolumeState,
    setRepeatMode,
    setShuffle,
  });

  useCurrentSongSync({
    songsRef,
    queueContextRef,
    baseQueueContextRef,
    setCurrentSong,
    persistCurrentSongId,
  });

  const { playSong, toggleShuffle } = usePlaybackQueueActions({
    songsRef,
    queueContextRef,
    baseQueueContextRef,
    nativeQueueRef,
    setPlaybackQueue,
    setCurrentSong,
    currentSongId: currentSong?.id,
    shuffle,
    setShuffle,
  });

  const {
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    playPlaylist,
  } = usePlaylistActions({
    playlists,
    setPlaylists,
    songsRef,
    playSong,
  });

  // Persist settings — but only AFTER hydration to avoid the initial state
  // (e.g. volume=1) overwriting persisted values from a previous session.
  useMusicPersistence({
    isReady,
    volume,
    shuffle,
    repeatMode,
    eqEnabled,
    eqBands,
    eqPreset,
    playlists,
    songs,
    setSongsState,
  });

  // ---- Library ----
  const setSongs = useCallback((s: Song[]) => {
    const validSongIds = new Set(s.map(song => song.id));
    setPlaylists(prev => prunePlaylists(prev, validSongIds));
    setSongsState(s);
  }, []);

  const addSongs = useCallback((s: Song[]) => {
    setSongsState(prev => {
      const existing = new Set(prev.map(x => x.id));
      return [...prev, ...s.filter(x => !existing.has(x.id))];
    });
  }, []);

  const updateSongMetadata = useCallback((songId: string, patch: Partial<Song>) => {
    const patchSong = (song: Song): Song =>
      song.id === songId ? { ...song, ...patch } : song;
    setSongsState(prev => prev.map(patchSong));
    setCurrentSong(prev => (prev?.id === songId ? { ...prev, ...patch } : prev));
    setPlaybackQueue(prev => prev.map(patchSong));
    queueContextRef.current = queueContextRef.current.map(patchSong);
    baseQueueContextRef.current = baseQueueContextRef.current.map(patchSong);
    nativeQueueRef.current = nativeQueueRef.current.map(patchSong);

    const queueIndex = nativeQueueRef.current.findIndex(song => song.id === songId);
    const queuedPatchedSong =
      (queueIndex >= 0 ? nativeQueueRef.current[queueIndex] : undefined) ??
      baseQueueContextRef.current.find(song => song.id === songId);
    if (!queuedPatchedSong || queueIndex < 0) return;

    void TrackPlayer.updateMetadataForTrack(queueIndex, toTrackPlayerTrack(queuedPatchedSong)).catch(
      () => undefined,
    );
  }, []);

  const value = useMemo<MusicContextValue>(
    () => buildMusicContextValue({
      songs,
      setSongs,
      addSongs,
      updateSongMetadata,
      currentSong,
      playbackQueue,
      isPlaying,
      isBuffering,
      playSong,
      togglePlayPause,
      stop,
      seekTo,
      next,
      previous,
      shuffle,
      toggleShuffle,
      repeatMode,
      cycleRepeatMode,
      volume,
      setVolume,
      eqEnabled,
      setEqEnabled,
      eqBands,
      setEqBand,
      eqPreset,
      applyEqPreset,
      eqNative,
      fftBins,
      visualizerRunning,
      visualizerError,
      palette,
      playlists,
      createPlaylist,
      deletePlaylist,
      renamePlaylist,
      addSongToPlaylist,
      removeSongFromPlaylist,
      playPlaylist,
      isReady,
    }),
    [
      songs,
      setSongs,
      addSongs,
      updateSongMetadata,
      currentSong,
      playbackQueue,
      isPlaying,
      isBuffering,
      playSong,
      togglePlayPause,
      stop,
      seekTo,
      next,
      previous,
      shuffle,
      toggleShuffle,
      repeatMode,
      cycleRepeatMode,
      volume,
      setVolume,
      eqEnabled,
      setEqEnabled,
      eqBands,
      setEqBand,
      eqPreset,
      applyEqPreset,
      eqNative,
      fftBins,
      visualizerRunning,
      visualizerError,
      palette,
      playlists,
      createPlaylist,
      deletePlaylist,
      renamePlaylist,
      addSongToPlaylist,
      removeSongFromPlaylist,
      playPlaylist,
      isReady,
    ],
  );

  const libraryValue = useMemo<LibraryMusicContextValue>(
    () => buildLibraryMusicContextValue(value),
    [value],
  );

  const miniPlayerValue = useMemo<MiniPlayerMusicContextValue>(
    () => buildMiniPlayerMusicContextValue(value),
    [value],
  );

  const nowPlayingValue = useMemo<NowPlayingMusicContextValue>(
    () => buildNowPlayingMusicContextValue(value),
    [value],
  );

  return (
    <MusicContext.Provider value={value}>
      <LibraryMusicContext.Provider value={libraryValue}>
        <MiniPlayerMusicContext.Provider value={miniPlayerValue}>
          <NowPlayingMusicContext.Provider value={nowPlayingValue}>
            {children}
          </NowPlayingMusicContext.Provider>
        </MiniPlayerMusicContext.Provider>
      </LibraryMusicContext.Provider>
    </MusicContext.Provider>
  );
};

export const useMusicContext = createRequiredContextHook(
  MusicContext,
  'useMusicContext',
  'MusicProvider',
);

export const useLibraryMusicContext = createRequiredContextHook(
  LibraryMusicContext,
  'useLibraryMusicContext',
  'MusicProvider',
);

export const useMiniPlayerMusicContext = createRequiredContextHook(
  MiniPlayerMusicContext,
  'useMiniPlayerMusicContext',
  'MusicProvider',
);

export const useNowPlayingMusicContext = createRequiredContextHook(
  NowPlayingMusicContext,
  'useNowPlayingMusicContext',
  'MusicProvider',
);