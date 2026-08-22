import { useRef } from 'react';
import type { EqPresetName, Playlist, RepeatMode, Song } from '../types/Song';
import { StorageKeys } from '../utils/storage';
import { usePersistedSetting } from './usePersistedSetting';
import { usePersistedSongs } from './usePersistedSongs';

interface UseMusicPersistenceArgs {
  isReady: boolean;
  libraryHydrationReady: boolean;
  volume: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  eqEnabled: boolean;
  eqBands: number[];
  eqPreset: EqPresetName | 'custom';
  playlists: Playlist[];
  songs: Song[];
  setSongsState: (songs: Song[]) => void;
}

export const useMusicPersistence = ({
  isReady,
  libraryHydrationReady,
  volume,
  shuffle,
  repeatMode,
  eqEnabled,
  eqBands,
  eqPreset,
  playlists,
  songs,
  setSongsState,
}: UseMusicPersistenceArgs): void => {
  const persistedRefs = useRef<Record<string, string>>({});

  usePersistedSetting(isReady, StorageKeys.VOLUME, volume, persistedRefs);
  usePersistedSetting(isReady, StorageKeys.SHUFFLE, shuffle, persistedRefs);
  usePersistedSetting(isReady, StorageKeys.REPEAT_MODE, repeatMode, persistedRefs);
  usePersistedSetting(isReady, StorageKeys.EQ_ENABLED, eqEnabled, persistedRefs);
  usePersistedSetting(isReady, StorageKeys.EQ_BANDS, eqBands, persistedRefs);
  usePersistedSetting(isReady, StorageKeys.EQ_PRESET, eqPreset, persistedRefs);
  // Playlist editing is intentionally available as soon as the safe library
  // snapshot is visible, before native playback hydration finishes.
  usePersistedSetting(libraryHydrationReady, StorageKeys.PLAYLISTS, playlists, persistedRefs);
  usePersistedSongs(isReady, songs, setSongsState, persistedRefs);
};
