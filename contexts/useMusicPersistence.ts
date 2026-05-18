import { useCallback, useEffect, useRef } from 'react';
import type { EqPresetName, Playlist, RepeatMode, Song } from '../types/Song';
import { sanitizeSongsForStorage } from '../utils/coverCache';
import { didSongCoversChange } from '../utils/musicHydration';
import { StorageKeys, storage } from '../utils/storage';

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

  const persistIfChanged = useCallback(
    async <T,>(key: string, value: T): Promise<void> => {
      const serialized = JSON.stringify(value);
      if (persistedRefs.current[key] === serialized) return;
      const stored = await storage.set(key, value);
      if (stored) persistedRefs.current[key] = serialized;
    },
    [],
  );

  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.VOLUME, volume);
  }, [volume, isReady, persistIfChanged]);

  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.SHUFFLE, shuffle);
  }, [shuffle, isReady, persistIfChanged]);

  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.REPEAT_MODE, repeatMode);
  }, [repeatMode, isReady, persistIfChanged]);

  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.EQ_ENABLED, eqEnabled);
  }, [eqEnabled, isReady, persistIfChanged]);

  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.EQ_BANDS, eqBands);
  }, [eqBands, isReady, persistIfChanged]);

  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.EQ_PRESET, eqPreset);
  }, [eqPreset, isReady, persistIfChanged]);

  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.PLAYLISTS, playlists);
  }, [playlists, isReady, persistIfChanged]);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    (async () => {
      const sanitizedSongs = await sanitizeSongsForStorage(songs);
      if (cancelled) return;
      if (didSongCoversChange(sanitizedSongs, songs)) {
        setSongsState(sanitizedSongs);
        return;
      }
      await persistIfChanged(StorageKeys.SONGS, sanitizedSongs);
    })();
    return () => {
      cancelled = true;
    };
  }, [songs, isReady, persistIfChanged, setSongsState]);
};
