import type { MusicContextValue } from './musicContextTypes';
import type { MusicProviderEffectsArgs } from './useMusicProviderEffects';
import type { MusicProviderState } from './useMusicProviderState';

type ContextStateInput = Pick<
  MusicContextValue,
  'songs' | 'songImport' | 'currentSong' | 'playbackQueue' | 'playlists' | 'shuffle' | 'isReady' | 'hydrationStatus' | 'retryHydration'
>;

type EffectsStateInput = Pick<
  MusicProviderEffectsArgs,
  | 'isReady'
  | 'libraryHydrationReady'
  | 'setIsReady'
  | 'setLibraryHydrationReady'
  | 'setHydrationStatus'
  | 'hydrationRetryToken'
  | 'songs'
  | 'songLibrary'
  | 'setSongsState'
  | 'currentSongSetter'
  | 'playbackQueueSetter'
  | 'playlists'
  | 'setPlaylists'
  | 'shuffle'
  | 'setShuffle'
>;

export const buildMusicProviderContextStateInput = ({
  songs, songLibrary,
  currentSong,
  playbackQueue,
  playlists,
  shuffle,
  isReady,
  hydrationStatus,
  retryHydration,
}: MusicProviderState): ContextStateInput => ({
  songs, ...(songLibrary ? { songImport: songLibrary } : {}),
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
  libraryHydrationReady,
  setIsReady,
  setLibraryHydrationReady,
  setHydrationStatus,
  hydrationRetryToken,
  songs, songLibrary,
  setSongsState,
  setCurrentSong,
  setPlaybackQueue,
  playlists,
  setPlaylists,
  shuffle,
  setShuffle,
}: MusicProviderState): EffectsStateInput => ({
  isReady,
  libraryHydrationReady,
  setIsReady,
  setLibraryHydrationReady,
  setHydrationStatus,
  hydrationRetryToken,
  songs, ...(songLibrary ? { songLibrary } : {}),
  setSongsState,
  currentSongSetter: setCurrentSong,
  playbackQueueSetter: setPlaybackQueue,
  playlists,
  setPlaylists,
  shuffle,
  setShuffle,
});
