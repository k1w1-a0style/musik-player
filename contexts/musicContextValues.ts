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
  | 'isReady'
  | 'isPlaying'
  | 'updateSongMetadata'
  | 'playlists'
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
  | 'volume'
  | 'setVolume'
  | 'palette'
  | 'playSong'
  | 'saveQueueAsPlaylist'
>;

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
}: LibraryMusicContextInput): LibraryMusicContextValue => ({
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
  volume,
  setVolume,
  palette,
  playSong,
  saveQueueAsPlaylist,
}: NowPlayingMusicContextInput): NowPlayingMusicContextValue => ({
  playbackQueue,
  currentSong,
  seekTo,
  isPlaying,
  volume,
  setVolume,
  palette,
  playSong,
  saveQueueAsPlaylist,
  canSkip: playbackQueue.length > 1,
});
