import type { MusicContextValue } from './musicContextTypes';
import type { MusicProviderEffectsArgs } from './useMusicProviderEffects';
import type { MusicProviderState } from './useMusicProviderState';

type ContextStateInput = Pick<
  MusicContextValue,
  'songs' | 'currentSong' | 'playbackQueue' | 'playlists' | 'shuffle' | 'isReady'
>;

type EffectsStateInput = Pick<
  MusicProviderEffectsArgs,
  | 'isReady'
  | 'setIsReady'
  | 'songs'
  | 'setSongsState'
  | 'currentSongSetter'
  | 'playbackQueueSetter'
  | 'playlists'
  | 'setPlaylists'
  | 'shuffle'
  | 'setShuffle'
>;

export const buildMusicProviderContextStateInput = ({
  songs,
  currentSong,
  playbackQueue,
  playlists,
  shuffle,
  isReady,
}: MusicProviderState): ContextStateInput => ({
  songs,
  currentSong,
  playbackQueue,
  playlists,
  shuffle,
  isReady,
});

export const buildMusicProviderEffectsStateInput = ({
  isReady,
  setIsReady,
  songs,
  setSongsState,
  setCurrentSong,
  setPlaybackQueue,
  playlists,
  setPlaylists,
  shuffle,
  setShuffle,
}: MusicProviderState): EffectsStateInput => ({
  isReady,
  setIsReady,
  songs,
  setSongsState,
  currentSongSetter: setCurrentSong,
  playbackQueueSetter: setPlaybackQueue,
  playlists,
  setPlaylists,
  shuffle,
  setShuffle,
});
