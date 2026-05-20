import type {
  LibraryMusicContextValue,
  MiniPlayerMusicContextValue,
  MusicContextValue,
  NowPlayingMusicContextValue,
} from './musicContextTypes';

export const buildLibraryMusicContextValue = ({
  songs,
  setSongs,
  currentSong,
  playSong,
  isReady,
  isPlaying,
  updateSongMetadata,
  playlists,
  playPlaylist,
}: MusicContextValue): LibraryMusicContextValue => ({
  songs,
  setSongs,
  currentSong,
  playSong,
  isReady,
  isPlaying,
  updateSongMetadata,
  playlists,
  playPlaylist,
});

export const buildMiniPlayerMusicContextValue = ({
  currentSong,
  isPlaying,
  togglePlayPause,
  next,
  previous,
  playbackQueue,
}: MusicContextValue): MiniPlayerMusicContextValue => ({
  currentSong,
  isPlaying,
  togglePlayPause,
  next,
  previous,
  canSkipNext: playbackQueue.length > 1,
  canSkipPrevious: currentSong !== null,
});

export const buildNowPlayingMusicContextValue = ({
  playbackQueue,
  currentSong,
  seekTo,
  isPlaying,
  volume,
  setVolume,
  palette,
  fftBins,
  visualizerRunning,
  visualizerError,
  playSong,
  saveQueueAsPlaylist,
}: MusicContextValue): NowPlayingMusicContextValue => ({
  playbackQueue,
  currentSong,
  seekTo,
  isPlaying,
  volume,
  setVolume,
  palette,
  fftBins,
  visualizerRunning,
  visualizerError,
  playSong,
  saveQueueAsPlaylist,
  canSkip: playbackQueue.length > 1,
});