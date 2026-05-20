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

interface ProvidedMusicContextValues {
  value: MusicContextValue;
  libraryValue: LibraryMusicContextValue;
  miniPlayerValue: MiniPlayerMusicContextValue;
  nowPlayingValue: NowPlayingMusicContextValue;
}

export const useProvidedMusicContextValues = (input: MusicContextValue): ProvidedMusicContextValues => {
  const value = useMusicContextValue(input);

  const libraryValue = useMemo(
    () => buildLibraryMusicContextValue(value),
    [
      value.songs,
      value.setSongs,
      value.currentSong,
      value.playSong,
      value.isReady,
      value.isPlaying,
      value.updateSongMetadata,
      value.playlists,
      value.playPlaylist,
    ],
  );

  const miniPlayerValue = useMemo(
    () => buildMiniPlayerMusicContextValue(value),
    [
      value.currentSong,
      value.isPlaying,
      value.togglePlayPause,
      value.next,
      value.previous,
      value.playbackQueue,
    ],
  );

  const nowPlayingValue = useMemo(
    () => buildNowPlayingMusicContextValue(value),
    [
      value.playbackQueue,
      value.currentSong,
      value.seekTo,
      value.isPlaying,
      value.volume,
      value.setVolume,
      value.palette,
      value.fftBins,
      value.visualizerRunning,
      value.visualizerError,
      value.playSong,
      value.saveQueueAsPlaylist,
    ],
  );

  return { value, libraryValue, miniPlayerValue, nowPlayingValue };
};
