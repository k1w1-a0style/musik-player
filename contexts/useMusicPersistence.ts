import { useRef, type MutableRefObject } from 'react';
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
  persistedRefs?: MutableRefObject<Record<string, string>>;
}

const CONTINUOUS_SETTING_DEBOUNCE_MS = 250;

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
  persistedRefs: sharedPersistedRefs,
}: UseMusicPersistenceArgs): void => {
  const localPersistedRefs = useRef<Record<string, string>>({});
  const persistedRefs = sharedPersistedRefs ?? localPersistedRefs;

  usePersistedSetting(isReady, StorageKeys.VOLUME, volume, persistedRefs, {
    debounceMs: CONTINUOUS_SETTING_DEBOUNCE_MS,
  });
  usePersistedSetting(isReady, StorageKeys.SHUFFLE, shuffle, persistedRefs);
  usePersistedSetting(isReady, StorageKeys.REPEAT_MODE, repeatMode, persistedRefs);
  usePersistedSetting(isReady, StorageKeys.EQ_ENABLED, eqEnabled, persistedRefs);
  usePersistedSetting(isReady, StorageKeys.EQ_BANDS, eqBands, persistedRefs, {
    debounceMs: CONTINUOUS_SETTING_DEBOUNCE_MS,
  });
  usePersistedSetting(isReady, StorageKeys.EQ_PRESET, eqPreset, persistedRefs);
  // Playlist editing is intentionally available as soon as the safe library
  // snapshot is visible, before native playback hydration finishes.
  usePersistedSetting(libraryHydrationReady, StorageKeys.PLAYLISTS, playlists, persistedRefs);
  usePersistedSongs(isReady, songs, setSongsState, persistedRefs);
};
