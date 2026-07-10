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
import { useSleepTimer } from '../screens/useSleepTimer';

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
    playSongNext,
    addSongToQueue,
    reorderQueue,
    isReady,
    isPlaying,
    updateSongMetadata,
    applySongMetadataPatches,
    playlists,
    deletePlaylist,
    renamePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    moveSongInPlaylist,
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
        playSongNext,
        addSongToQueue,
        isReady,
        isPlaying,
        updateSongMetadata,
        applySongMetadataPatches,
        playlists,
        deletePlaylist,
        renamePlaylist,
        addSongToPlaylist,
        removeSongFromPlaylist,
        moveSongInPlaylist,
        playPlaylist,
      }),
    [
      songs,
      setSongs,
      currentSong,
      playSong,
      playSongNext,
      addSongToQueue,
      isReady,
      isPlaying,
      updateSongMetadata,
      applySongMetadataPatches,
      playlists,
      deletePlaylist,
      renamePlaylist,
      addSongToPlaylist,
      removeSongFromPlaylist,
      moveSongInPlaylist,
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

  const sleepTimerState = useSleepTimer();

  const nowPlayingValue = useMemo(
    () =>
      buildNowPlayingMusicContextValue({
        playbackQueue,
        currentSong,
        seekTo,
        isPlaying,
        togglePlayPause,
        ...sleepTimerState,
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
      togglePlayPause,
      sleepTimerState,
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
