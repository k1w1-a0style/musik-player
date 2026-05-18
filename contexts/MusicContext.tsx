import React, {
  useState,
  type ReactNode,
} from 'react';
import {
  type Playlist,
  type Song,
} from '../types/Song';
import { MusicContextProviders } from './MusicContextProviders';
import { useAlbumPalette } from './useAlbumPalette';
import { useAudioVisualizer } from './useAudioVisualizer';
import { useCurrentSongSync } from './useCurrentSongSync';
import { useEqualizerControls } from './useEqualizerControls';
import { useLibraryActions } from './useLibraryActions';
import { useMusicHydration } from './useMusicHydration';
import { useMusicPersistence } from './useMusicPersistence';
import { useMusicPlaybackRefs } from './useMusicPlaybackRefs';
import { useNativeEqualizer } from './useNativeEqualizer';
import { usePlaybackControls } from './usePlaybackControls';
import { usePlaybackQueueActions } from './usePlaybackQueueActions';
import { usePlaylistActions } from './usePlaylistActions';
import { useProvidedMusicContextValues } from './useProvidedMusicContextValues';
export {
  useLibraryMusicContext,
  useMiniPlayerMusicContext,
  useMusicContext,
  useNowPlayingMusicContext,
} from './musicContexts';

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

  const {
    songsRef,
    queueContextRef,
    baseQueueContextRef,
    nativeQueueRef,
    persistCurrentSongId,
  } = useMusicPlaybackRefs(songs);

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

  const { setSongs, addSongs, updateSongMetadata } = useLibraryActions({
    queueContextRef,
    baseQueueContextRef,
    nativeQueueRef,
    setSongsState,
    setCurrentSong,
    setPlaybackQueue,
    setPlaylists,
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

  const { value, libraryValue, miniPlayerValue, nowPlayingValue } =
    useProvidedMusicContextValues({
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
    });

  return (
    <MusicContextProviders
      value={value}
      libraryValue={libraryValue}
      miniPlayerValue={miniPlayerValue}
      nowPlayingValue={nowPlayingValue}
    >
      {children}
    </MusicContextProviders>
  );
};
