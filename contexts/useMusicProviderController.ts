import {
  buildMusicProviderContextEqualizerInput,
  buildMusicProviderContextPlaybackInput,
  buildMusicProviderEffectsEqualizerInput,
  buildMusicProviderEffectsPlaybackInput,
} from './musicProviderControlInput';
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

  const { playback, equalizer } = useMusicProviderControls();
  const { isPlaying } = playback;
  const { eqEnabled, eqBands } = equalizer;

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
      playback: buildMusicProviderEffectsPlaybackInput(playback),
      equalizer: buildMusicProviderEffectsEqualizerInput(equalizer),
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
      playback: buildMusicProviderContextPlaybackInput(playback, {
        playSong,
        toggleShuffle,
      }),
      equalizer: buildMusicProviderContextEqualizerInput(equalizer),
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
