import type {
  LibraryMusicContextValue,
  MiniPlayerMusicContextValue,
  MusicContextValue,
  NowPlayingMusicContextValue,
} from './musicContextTypes';

type LibraryMusicContextInput = Pick<
  MusicContextValue,
  | 'songs'
  | 'setSongs'
  | 'currentSong'
  | 'playSong'
  | 'playSongNext'
  | 'addSongToQueue'
  | 'isReady'
  | 'isPlaying'
  | 'updateSongMetadata'
  | 'applySongMetadataPatches'
  | 'playlists'
  | 'createPlaylist'
  | 'deletePlaylist'
  | 'renamePlaylist'
  | 'addSongToPlaylist'
  | 'removeSongFromPlaylist'
  | 'moveSongInPlaylist'
  | 'playPlaylist'
>;

type MiniPlayerMusicContextInput = Pick<
  MusicContextValue,
  'currentSong' | 'isPlaying' | 'togglePlayPause' | 'next' | 'previous' | 'playbackQueue'
>;

type NowPlayingMusicContextInput = Pick<
  MusicContextValue,
  | 'playbackQueue'
  | 'currentSong'
  | 'seekTo'
  | 'isPlaying'
  | 'togglePlayPause'
  | 'volume'
  | 'setVolume'
  | 'palette'
  | 'paletteLoading'
  | 'playSong'
  | 'next'
  | 'previous'
  | 'reorderQueue'
  | 'saveQueueAsPlaylist'
  | 'repeatMode'
> & Pick<
  NowPlayingMusicContextValue,
  'sleepTimerActive' | 'sleepTimerRemainingSeconds' | 'startSleepTimer' | 'cancelSleepTimer'
>;

export const buildLibraryMusicContextValue = ({
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
}: LibraryMusicContextInput): LibraryMusicContextValue => ({
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
});

export const buildMiniPlayerMusicContextValue = ({
  currentSong,
  isPlaying,
  togglePlayPause,
  next,
  previous,
  playbackQueue,
}: MiniPlayerMusicContextInput): MiniPlayerMusicContextValue => ({
  currentSong,
  isPlaying,
  togglePlayPause,
  next,
  previous,
  canSkipNext: currentSong !== null && playbackQueue.length > 1,
  canSkipPrevious: currentSong !== null,
});

export const buildNowPlayingMusicContextValue = ({
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
  repeatMode,
}: NowPlayingMusicContextInput): NowPlayingMusicContextValue => ({
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
  ...(paletteLoading === undefined ? {} : { paletteLoading }),
  playSong,
  next,
  previous,
  reorderQueue,
  saveQueueAsPlaylist,
  repeatMode,
  canSkip: playbackQueue.length > 1,
});
