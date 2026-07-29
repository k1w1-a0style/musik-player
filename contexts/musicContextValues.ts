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
  | 'hydrationStatus'
  | 'retryHydration'
>;

type MiniPlayerMusicContextInput = Pick<
  MusicContextValue,
  'currentSong' | 'isPlaying' | 'togglePlayPause' | 'next' | 'previous' | 'playbackQueue' | 'hydrationStatus' | 'retryHydration'
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
  | 'hydrationStatus'
  | 'retryHydration'
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
  hydrationStatus,
  retryHydration,
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
  ...(hydrationStatus === undefined ? {} : { hydrationStatus }),
  ...(retryHydration === undefined ? {} : { retryHydration }),
});

export const buildMiniPlayerMusicContextValue = ({
  currentSong,
  isPlaying,
  togglePlayPause,
  next,
  previous,
  playbackQueue,
  hydrationStatus,
  retryHydration,
}: MiniPlayerMusicContextInput): MiniPlayerMusicContextValue => ({
  currentSong,
  isPlaying,
  togglePlayPause,
  next,
  previous,
  canSkipNext: currentSong !== null && playbackQueue.length > 1,
  canSkipPrevious: currentSong !== null,
  ...(hydrationStatus === undefined ? {} : { hydrationStatus }),
  ...(retryHydration === undefined ? {} : { retryHydration }),
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
  hydrationStatus,
  retryHydration,
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
  ...(hydrationStatus === undefined ? {} : { hydrationStatus }),
  ...(retryHydration === undefined ? {} : { retryHydration }),
});
