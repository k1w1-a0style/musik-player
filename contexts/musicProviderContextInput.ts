import type { MusicContextValue } from './musicContextTypes';

type StateInput = Pick<
  MusicContextValue,
  'songs' | 'currentSong' | 'playbackQueue' | 'playlists' | 'shuffle' | 'isReady'
>;

type LibraryInput = Pick<
  MusicContextValue,
  'setSongs' | 'addSongs' | 'updateSongMetadata'
>;

type PlaybackInput = Pick<
  MusicContextValue,
  | 'isPlaying'
  | 'isBuffering'
  | 'playSong'
  | 'togglePlayPause'
  | 'stop'
  | 'seekTo'
  | 'next'
  | 'previous'
  | 'toggleShuffle'
  | 'repeatMode'
  | 'cycleRepeatMode'
  | 'volume'
  | 'setVolume'
>;

type EqualizerInput = Pick<
  MusicContextValue,
  'eqEnabled' | 'setEqEnabled' | 'eqBands' | 'setEqBand' | 'eqPreset' | 'applyEqPreset'
>;

type AudioFeatureInput = Pick<
  MusicContextValue,
  'eqNative' | 'fftBins' | 'visualizerRunning' | 'visualizerError' | 'palette'
>;

type PlaylistInput = Pick<
  MusicContextValue,
  | 'createPlaylist'
  | 'deletePlaylist'
  | 'renamePlaylist'
  | 'addSongToPlaylist'
  | 'removeSongFromPlaylist'
  | 'playPlaylist'
>;

interface MusicProviderContextInputSections {
  state: StateInput;
  library: LibraryInput;
  playback: PlaybackInput;
  equalizer: EqualizerInput;
  audioFeatures: AudioFeatureInput;
  playlists: PlaylistInput;
}

export const buildMusicProviderContextInput = ({
  state,
  library,
  playback,
  equalizer,
  audioFeatures,
  playlists,
}: MusicProviderContextInputSections): MusicContextValue => ({
  ...state,
  ...library,
  ...playback,
  ...equalizer,
  ...audioFeatures,
  ...playlists,
});
