import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { EqPresetName, Playlist, RepeatMode, Song } from '../types/Song';
import { useCurrentSongSync } from './useCurrentSongSync';
import { useMusicHydration } from './useMusicHydration';
import { useMusicPersistence } from './useMusicPersistence';
import { waitForPersistQueueIdle } from './musicPersistenceHelpers';
import type { BeforeStorageHydrationResult } from './musicHydrationTypes';
import { StorageKeys } from '../utils/storage';

export interface MusicProviderEffectsArgs {
  songsRef: MutableRefObject<Song[]>;
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  nativeQueueRef: MutableRefObject<Song[]>;
  persistCurrentSongId: (song: Song | null) => Promise<void>;
  isReady: boolean;
  libraryHydrationReady: boolean;
  setIsReady: Dispatch<SetStateAction<boolean>>;
  setLibraryHydrationReady: Dispatch<SetStateAction<boolean>>;
  setHydrationStatus?: Dispatch<SetStateAction<'loading' | 'ready' | 'degraded' | 'retry-required'>>;
  hydrationRetryToken?: number;
  songs: Song[];
  songLibrary?: import('./songLibraryState').SongLibraryState;
  setSongsState: Dispatch<SetStateAction<Song[]>>;
  currentSongSetter: Dispatch<SetStateAction<Song | null>>;
  playbackQueueSetter: Dispatch<SetStateAction<Song[]>>;
  playlists: Playlist[];
  setPlaylists: Dispatch<SetStateAction<Playlist[]>>;
  shuffle: boolean;
  setShuffle: Dispatch<SetStateAction<boolean>>;
  repeatMode: RepeatMode;
  setRepeatMode: Dispatch<SetStateAction<RepeatMode>>;
  volume: number;
  setVolumeState: Dispatch<SetStateAction<number>>;
  eqEnabled: boolean;
  setEqEnabledState: Dispatch<SetStateAction<boolean>>;
  eqBands: number[];
  setEqBandsState: Dispatch<SetStateAction<number[]>>;
  eqPreset: EqPresetName | 'custom';
  setEqPreset: Dispatch<SetStateAction<EqPresetName | 'custom'>>;
}

const useStorageHydrationBarrier = (
  persistedRefs: MutableRefObject<Record<string, string>>,
  flushSongsForHydration: () => ReturnType<typeof waitForPersistQueueIdle>,
) => {
  const beforeStorageHydration = useCallback(async (): Promise<BeforeStorageHydrationResult> => {
    const songResult = await flushSongsForHydration();
    if (songResult.status === 'failed') return { status: 'retry-required', error: songResult.error };
    const result = await waitForPersistQueueIdle(StorageKeys.PLAYLISTS, persistedRefs.current);
    return result.status === 'failed'
      ? { status: 'retry-required', error: result.error }
      : { status: 'ready' };
  }, [flushSongsForHydration, persistedRefs]);
  return beforeStorageHydration;
};

export const useMusicProviderEffects = ({
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  persistCurrentSongId,
  isReady,
  libraryHydrationReady,
  setIsReady,
  setLibraryHydrationReady,
  setHydrationStatus,
  hydrationRetryToken,
  songs, songLibrary,
  setSongsState,
  currentSongSetter,
  playbackQueueSetter,
  playlists,
  setPlaylists,
  shuffle,
  setShuffle,
  repeatMode,
  setRepeatMode,
  volume,
  setVolumeState,
  eqEnabled,
  setEqEnabledState,
  eqBands,
  setEqBandsState,
  eqPreset,
  setEqPreset,
}: MusicProviderEffectsArgs): void => {
  const persistedRefs = useRef<Record<string, string>>({});
  const flushSongsForHydration = useMusicPersistence({
    isReady,
    libraryHydrationReady,
    volume,
    shuffle,
    repeatMode,
    eqEnabled,
    eqBands,
    eqPreset,
    playlists,
    songs, songLibrary,
    setSongsState,
    persistedRefs,
  });
  const beforeStorageHydration = useStorageHydrationBarrier(persistedRefs, flushSongsForHydration);

  useMusicHydration({
    songsRef,
    queueContextRef,
    baseQueueContextRef,
    nativeQueueRef,
    setIsReady,
    libraryHydrationReady,
    beforeStorageHydration,
    setLibraryHydrationReady,
    setHydrationStatus,
    hydrationRetryToken,
    setSongsState,
    setCurrentSong: currentSongSetter,
    setPlaybackQueue: playbackQueueSetter,
    setPlaylists,
    setEqEnabledState,
    setEqBandsState,
    setEqPreset,
    setVolumeState,
    setRepeatMode,
    setShuffle,
  });

  useCurrentSongSync({
    songsRef,
    queueContextRef,
    baseQueueContextRef,
    setCurrentSong: currentSongSetter,
    persistCurrentSongId,
  });
};
