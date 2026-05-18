import { useAlbumPalette } from './useAlbumPalette';
import { useAudioVisualizer } from './useAudioVisualizer';
import { useCurrentSongSync } from './useCurrentSongSync';
import { useEqualizerControls } from './useEqualizerControls';
import { useLibraryActions } from './useLibraryActions';
import { useMusicHydration } from './useMusicHydration';
import { useMusicPersistence } from './useMusicPersistence';
import { useMusicPlaybackRefs } from './useMusicPlaybackRefs';
import { useMusicProviderState } from './useMusicProviderState';
import { useNativeEqualizer } from './useNativeEqualizer';
import { usePlaybackControls } from './usePlaybackControls';
import { usePlaybackQueueActions } from './usePlaybackQueueActions';
import { usePlaylistActions } from './usePlaylistActions';
import { useProvidedMusicContextValues } from './useProvidedMusicContextValues';

export const useMusicProviderController = () => {
  const {
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
  } = useMusicProviderState();

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

  return useProvidedMusicContextValues({
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
};
