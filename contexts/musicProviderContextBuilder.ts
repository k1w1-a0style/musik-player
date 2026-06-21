import type { MusicContextValue } from './musicContextTypes';

export const buildMusicProviderContextValue = (sections: {
  state: Pick<MusicContextValue, 'songs' | 'currentSong' | 'playbackQueue' | 'playlists' | 'shuffle' | 'isReady'>;
  library: Pick<MusicContextValue, 'setSongs' | 'addSongs' | 'updateSongMetadata' | 'applySongMetadataPatches'>;
  playback: Pick<MusicContextValue, 'isPlaying' | 'isBuffering' | 'playSong' | 'reorderQueue' | 'togglePlayPause' | 'stop' | 'seekTo' | 'next' | 'previous' | 'toggleShuffle' | 'repeatMode' | 'cycleRepeatMode' | 'volume' | 'setVolume'>;
  equalizer: Pick<MusicContextValue, 'eqEnabled' | 'setEqEnabled' | 'eqBands' | 'setEqBand' | 'eqPreset' | 'applyEqPreset'>;
  audioFeatures: Pick<MusicContextValue, 'eqNative' | 'palette'>;
  playlists: Pick<MusicContextValue, 'createPlaylist' | 'saveQueueAsPlaylist' | 'deletePlaylist' | 'renamePlaylist' | 'addSongToPlaylist' | 'removeSongFromPlaylist' | 'playPlaylist'>;
}): MusicContextValue => ({
  ...sections.state,
  ...sections.library,
  ...sections.playback,
  ...sections.equalizer,
  ...sections.audioFeatures,
  ...sections.playlists,
});
