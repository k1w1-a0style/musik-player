import type { MusicContextValue } from './musicContextTypes';
import type { MusicProviderEffectsArgs } from './useMusicProviderEffects';
import type { MusicProviderState } from './useMusicProviderState';

type ContextStateInput = Pick<
  MusicContextValue,
  'songs' | 'currentSong' | 'playbackQueue' | 'playlists' | 'shuffle' | 'isReady' | 'hydrationStatus' | 'retryHydration'
>;

type EffectsStateInput = Pick<
  MusicProviderEffectsArgs,
  | 'isReady'
  | 'setIsReady'
  | 'setHydrationStatus'
  | 'hydrationRetryToken'
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
  hydrationStatus,
  retryHydration,
}: MusicProviderState): ContextStateInput => ({
  songs,
  currentSong,
  playbackQueue,
  playlists,
  shuffle,
  isReady,
  hydrationStatus,
  retryHydration,
});

export const buildMusicProviderEffectsStateInput = ({
  isReady,
  setIsReady,
  setHydrationStatus,
  hydrationRetryToken,
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
  setHydrationStatus,
  hydrationRetryToken,
  songs,
  setSongsState,
  currentSongSetter: setCurrentSong,
  playbackQueueSetter: setPlaybackQueue,
  playlists,
  setPlaylists,
  shuffle,
  setShuffle,
});
