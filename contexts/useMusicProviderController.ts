import { useEqualizerControls } from './useEqualizerControls';
import { useMusicPlaybackRefs } from './useMusicPlaybackRefs';
import { useMusicProviderActions } from './useMusicProviderActions';
import { useMusicProviderAudioFeatures } from './useMusicProviderAudioFeatures';
import { useMusicProviderEffects } from './useMusicProviderEffects';
import { useMusicProviderState } from './useMusicProviderState';
import { usePlaybackControls } from './usePlaybackControls';
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

  const { eqNative, palette, fftBins, visualizerRunning, visualizerError } =
    useMusicProviderAudioFeatures({
      currentSong,
      eqEnabled,
      eqBands,
      isPlaying,
    });

  const {
    songsRef,
    queueContextRef,
    baseQueueContextRef,
    nativeQueueRef,
    persistCurrentSongId,
  } = useMusicPlaybackRefs(songs);

  const {
    playSong,
    toggleShuffle,
    setSongs,
    addSongs,
    updateSongMetadata,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    playPlaylist,
  } = useMusicProviderActions({
    songsRef,
    queueContextRef,
    baseQueueContextRef,
    nativeQueueRef,
    setSongsState,
    setCurrentSong,
    setPlaybackQueue,
    playlists,
    setPlaylists,
    currentSongId: currentSong?.id,
    shuffle,
    setShuffle,
  });

  useMusicProviderEffects({
    songsRef,
    queueContextRef,
    baseQueueContextRef,
    nativeQueueRef,
    persistCurrentSongId,
    isReady,
    setIsReady,
    songs,
    setSongsState,
    currentSongSetter: setCurrentSong,
    playbackQueueSetter: setPlaybackQueue,
    playlists,
    setPlaylists,
    shuffle,
    setShuffle,
    repeatMode,
    setRepeatMode,
    volume,
    setVolumeState,
    eqEnabled,
    setEqEnabledState,
    eqBands,
    setEqBandsState,
    eqPreset,
    setEqPreset,
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