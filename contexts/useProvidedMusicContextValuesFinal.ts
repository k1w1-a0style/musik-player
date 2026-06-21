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

export interface ProvidedMusicContextValuesFinal {
  value: MusicContextValue;
  libraryValue: LibraryMusicContextValue;
  miniPlayerValue: MiniPlayerMusicContextValue;
  nowPlayingValue: NowPlayingMusicContextValue;
}

export const useProvidedMusicContextValuesFinal = (input: MusicContextValue): ProvidedMusicContextValuesFinal => {
  const value = useMusicContextValue(input);
  const {
    songs,
    setSongs,
    currentSong,
    playSong,
    isReady,
    isPlaying,
    updateSongMetadata,
    applySongMetadataPatches,
    playlists,
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
  const queueOrderAction = value['reorderQueue'];

  const libraryValue = useMemo(
    () => buildLibraryMusicContextValue({
      songs,
      setSongs,
      currentSong,
      playSong,
      isReady,
      isPlaying,
      updateSongMetadata,
      applySongMetadataPatches,
      playlists,
      playPlaylist,
    }),
    [songs, setSongs, currentSong, playSong, isReady, isPlaying, updateSongMetadata, applySongMetadataPatches, playlists, playPlaylist],
  );

  const miniPlayerValue = useMemo(
    () => buildMiniPlayerMusicContextValue({ currentSong, isPlaying, togglePlayPause, next, previous, playbackQueue }),
    [currentSong, isPlaying, togglePlayPause, next, previous, playbackQueue],
  );

  const nowPlayingValue = useMemo(
    () => buildNowPlayingMusicContextValue({
      playbackQueue,
      currentSong,
      seekTo,
      isPlaying,
      volume,
      setVolume,
      palette,
      playSong,
      reorderQueue: queueOrderAction,
      saveQueueAsPlaylist,
    }),
    [playbackQueue, currentSong, seekTo, isPlaying, volume, setVolume, palette, playSong, queueOrderAction, saveQueueAsPlaylist],
  );

  return { value, libraryValue, miniPlayerValue, nowPlayingValue };
};
