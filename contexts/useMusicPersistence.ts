import { useEffect, useRef } from 'react';
import type { EqPresetName, Playlist, RepeatMode, Song } from '../types/Song';
import { StorageKeys } from '../utils/storage';
import {
  persistIfChanged,
  prepareSongsForPersistence,
} from './musicPersistenceHelpers';

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

  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.VOLUME, volume, persistedRefs.current);
  }, [volume, isReady]);

  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.SHUFFLE, shuffle, persistedRefs.current);
  }, [shuffle, isReady]);

  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.REPEAT_MODE, repeatMode, persistedRefs.current);
  }, [repeatMode, isReady]);

  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.EQ_ENABLED, eqEnabled, persistedRefs.current);
  }, [eqEnabled, isReady]);

  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.EQ_BANDS, eqBands, persistedRefs.current);
  }, [eqBands, isReady]);

  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.EQ_PRESET, eqPreset, persistedRefs.current);
  }, [eqPreset, isReady]);

  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.PLAYLISTS, playlists, persistedRefs.current);
  }, [playlists, isReady]);

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
