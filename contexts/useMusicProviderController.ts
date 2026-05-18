import { buildMusicProviderContextInput } from './musicProviderContextInput';
import { buildMusicProviderEffectsInput } from './musicProviderEffectsInput';
import {
  buildMusicProviderContextStateInput,
  buildMusicProviderEffectsStateInput,
} from './musicProviderStateInput';
import { useMusicPlaybackRefs } from './useMusicPlaybackRefs';
import { useMusicProviderActions } from './useMusicProviderActions';
import { useMusicProviderAudioFeatures } from './useMusicProviderAudioFeatures';
import { useMusicProviderControls } from './useMusicProviderControls';
import { useMusicProviderEffects } from './useMusicProviderEffects';
import { useMusicProviderState } from './useMusicProviderState';
import { useProvidedMusicContextValues } from './useProvidedMusicContextValues';

export const useMusicProviderController = () => {
  const providerState = useMusicProviderState();
  const {
    isReady,
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
  } = providerState;

  const {
    playback: {
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
    },
    equalizer: {
      eqEnabled,
      setEqEnabled,
      setEqEnabledState,
      eqBands,
      setEqBand,
      setEqBandsState,
      eqPreset,
      applyEqPreset,
      setEqPreset,
    },
  } = useMusicProviderControls();

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

  useMusicProviderEffects(
    buildMusicProviderEffectsInput({
      refs: {
        songsRef,
        queueContextRef,
        baseQueueContextRef,
        nativeQueueRef,
        persistCurrentSongId,
      },
      state: buildMusicProviderEffectsStateInput(providerState),
      playback: {
        repeatMode,
        setRepeatMode,
        volume,
        setVolumeState,
      },
      equalizer: {
        eqEnabled,
        setEqEnabledState,
        eqBands,
        setEqBandsState,
        eqPreset,
        setEqPreset,
      },
    }),
  );

  return useProvidedMusicContextValues(
    buildMusicProviderContextInput({
      state: buildMusicProviderContextStateInput(providerState),
      library: {
        setSongs,
        addSongs,
        updateSongMetadata,
      },
      playback: {
        isPlaying,
        isBuffering,
        playSong,
        togglePlayPause,
        stop,
        seekTo,
        next,
        previous,
        toggleShuffle,
        repeatMode,
        cycleRepeatMode,
        volume,
        setVolume,
      },
      equalizer: {
        eqEnabled,
        setEqEnabled,
        eqBands,
        setEqBand,
        eqPreset,
        applyEqPreset,
      },
      audioFeatures: {
        eqNative,
        fftBins,
        visualizerRunning,
        visualizerError,
        palette,
      },
      playlists: {
        createPlaylist,
        deletePlaylist,
        renamePlaylist,
        addSongToPlaylist,
        removeSongFromPlaylist,
        playPlaylist,
      },
    }),
  );
};
