import { useEffect, useRef } from 'react';
import type { EqPresetName, Playlist, RepeatMode, Song } from '../types/Song';
import { StorageKeys } from '../utils/storage';
import {
  persistIfChanged,
  prepareSongsForPersistence,
} from './musicPersistenceHelpers';
import { usePersistedSetting } from './usePersistedSetting';

interface UseMusicPersistenceArgs {
  isReady: boolean;
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
  usePersistedSetting(isReady, StorageKeys.PLAYLISTS, playlists, persistedRefs);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    (async () => {
      const { sanitizedSongs, coversChanged } = await prepareSongsForPersistence(songs);
      if (cancelled) return;
      if (coversChanged) {
        setSongsState(sanitizedSongs);
        return;
      }
      await persistIfChanged(StorageKeys.SONGS, sanitizedSongs, persistedRefs.current);
    })();
    return () => {
      cancelled = true;
    };
  }, [songs, isReady, setSongsState]);
};
