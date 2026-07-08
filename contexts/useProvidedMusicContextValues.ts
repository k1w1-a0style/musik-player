import { useMemo } from 'react';
import {
  buildLibraryMusicContextValue,
  buildMiniPlayerMusicContextValue,
  buildNowPlayingMusicContextValue,
} from './musicContextValues';
import type {
  LibraryMusicContextValue,
  MiniPlayerMusicContextValue,
  MusicContextValue,
  NowPlayingMusicContextValue,
} from './musicContextTypes';
import { useMusicContextValue } from './useMusicContextValue';

export interface ProvidedMusicContextValues {
  value: MusicContextValue;
  libraryValue: LibraryMusicContextValue;
  miniPlayerValue: MiniPlayerMusicContextValue;
  nowPlayingValue: NowPlayingMusicContextValue;
}

export const useProvidedMusicContextValues = (input: MusicContextValue): ProvidedMusicContextValues => {
  const value = useMusicContextValue(input);
  const {
    songs,
    setSongs,
    currentSong,
    playSong,
    reorderQueue,
    isReady,
    isPlaying,
    updateSongMetadata,
    applySongMetadataPatches,
    playlists,
    deletePlaylist,
    playPlaylist,
    togglePlayPause,
    next,
    previous,
    playbackQueue,
    seekTo,
    volume,
    setVolume,
    palette,
    saveQueueAsPlaylist,
  } = value;

  const libraryValue = useMemo(
    () =>
      buildLibraryMusicContextValue({
        songs,
        setSongs,
        currentSong,
        playSong,
        isReady,
        isPlaying,
        updateSongMetadata,
        applySongMetadataPatches,
        playlists,
        deletePlaylist,
        playPlaylist,
      }),
    [
      songs,
      setSongs,
      currentSong,
      playSong,
      isReady,
      isPlaying,
      updateSongMetadata,
      applySongMetadataPatches,
      playlists,
      deletePlaylist,
      playPlaylist,
    ],
  );

  const miniPlayerValue = useMemo(
    () =>
      buildMiniPlayerMusicContextValue({
        currentSong,
        isPlaying,
        togglePlayPause,
        next,
        previous,
        playbackQueue,
      }),
    [
      currentSong,
      isPlaying,
      togglePlayPause,
      next,
      previous,
      playbackQueue,
    ],
  );

  const nowPlayingValue = useMemo(
    () =>
      buildNowPlayingMusicContextValue({
        playbackQueue,
        currentSong,
        seekTo,
        isPlaying,
        volume,
        setVolume,
        palette,
        playSong,
        next,
        previous,
        reorderQueue,
        saveQueueAsPlaylist,
      }),
    [
      playbackQueue,
      currentSong,
      seekTo,
      isPlaying,
      volume,
      setVolume,
      palette,
      playSong,
      next,
      previous,
      reorderQueue,
      saveQueueAsPlaylist,
    ],
  );

  return { value, libraryValue, miniPlayerValue, nowPlayingValue };
};
