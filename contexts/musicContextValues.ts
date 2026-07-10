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
  | 'deletePlaylist'
  | 'renamePlaylist'
  | 'addSongToPlaylist'
  | 'removeSongFromPlaylist'
  | 'moveSongInPlaylist'
  | 'playPlaylist'
>;

type MiniPlayerMusicContextInput = Pick<
  MusicContextValue,
  'currentSong' | 'isPlaying' | 'togglePlayPause' | 'next' | 'previous' | 'playbackQueue' | 'palette'
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
  | 'playSong'
  | 'next'
  | 'previous'
  | 'reorderQueue'
  | 'saveQueueAsPlaylist'
> & Pick<
  NowPlayingMusicContextValue,
  'sleepTimerActive' | 'startSleepTimer' | 'cancelSleepTimer'
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
  palette,
}: MiniPlayerMusicContextInput): MiniPlayerMusicContextValue => ({
  currentSong,
  isPlaying,
  togglePlayPause,
  next,
  previous,
  canSkipNext: currentSong !== null && playbackQueue.length > 1,
  canSkipPrevious: currentSong !== null,
  palette,
});

export const buildNowPlayingMusicContextValue = ({
  playbackQueue,
  currentSong,
  seekTo,
  isPlaying,
  togglePlayPause,
  sleepTimerActive,
  startSleepTimer,
  cancelSleepTimer,
  volume,
  setVolume,
  palette,
  playSong,
  next,
  previous,
  reorderQueue,
  saveQueueAsPlaylist,
}: NowPlayingMusicContextInput): NowPlayingMusicContextValue => ({
  playbackQueue,
  currentSong,
  seekTo,
  isPlaying,
  togglePlayPause,
  sleepTimerActive,
  startSleepTimer,
  cancelSleepTimer,
  volume,
  setVolume,
  palette,
  playSong,
  next,
  previous,
  reorderQueue,
  saveQueueAsPlaylist,
  canSkip: playbackQueue.length > 1,
});
