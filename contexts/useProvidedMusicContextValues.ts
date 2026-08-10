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
    songs, setSongs,
    currentSong, playSong,
    playSongNext,
    addSongToQueue,
    reorderQueue,
    isReady,
    isPlaying,
    updateSongMetadata,
    applySongMetadataPatches,
    playlists,
    createPlaylist,
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
    palette, paletteLoading,
    saveQueueAsPlaylist,
    shuffle, toggleShuffle,
    repeatMode, cycleRepeatMode,
    hydrationStatus, retryHydration,
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
        createPlaylist,
        deletePlaylist,
        renamePlaylist,
        addSongToPlaylist,
        removeSongFromPlaylist,
        moveSongInPlaylist,
        playPlaylist,
        hydrationStatus, retryHydration,
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
      createPlaylist,
      deletePlaylist,
      renamePlaylist,
      addSongToPlaylist,
      removeSongFromPlaylist,
      moveSongInPlaylist,
      playPlaylist,
      hydrationStatus, retryHydration,
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
        repeatMode, palette,
        hydrationStatus, retryHydration,
      }),
    [
      currentSong,
      isPlaying,
      togglePlayPause,
      next,
      previous,
      playbackQueue,
      repeatMode, palette,
      hydrationStatus, retryHydration,
    ],
  );
  const { sleepTimerActive, sleepTimerRemainingSeconds,
    startSleepTimer, cancelSleepTimer } = useSleepTimer();
  const nowPlayingValue = useMemo(
    () =>
      buildNowPlayingMusicContextValue({
        playbackQueue,
        currentSong,
        seekTo,
        isPlaying,
        togglePlayPause,
        sleepTimerActive,
        sleepTimerRemainingSeconds,
        startSleepTimer,
        cancelSleepTimer,
        volume,
        setVolume,
        palette,
        paletteLoading,
        playSong,
        next,
        previous,
        reorderQueue,
        saveQueueAsPlaylist,
        shuffle, toggleShuffle,
        repeatMode, cycleRepeatMode,
        hydrationStatus, retryHydration,
      }),
    [
      playbackQueue,
      currentSong,
      seekTo,
      isPlaying,
      togglePlayPause,
      sleepTimerActive,
      sleepTimerRemainingSeconds,
      startSleepTimer,
      cancelSleepTimer,
      volume,
      setVolume,
      palette,
      paletteLoading,
      playSong,
      next,
      previous,
      reorderQueue,
      saveQueueAsPlaylist,
      shuffle, toggleShuffle,
      repeatMode, cycleRepeatMode,
      hydrationStatus, retryHydration,
    ],
  );
  return { value, libraryValue, miniPlayerValue, nowPlayingValue };
};
