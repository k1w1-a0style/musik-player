import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { EqPresetName, Playlist, RepeatMode, Song } from '../types/Song';
import { useCurrentSongSync } from './useCurrentSongSync';
import { useMusicHydration } from './useMusicHydration';
import { useMusicPersistence } from './useMusicPersistence';

interface MusicProviderEffectsArgs {
  songsRef: MutableRefObject<Song[]>;
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  nativeQueueRef: MutableRefObject<Song[]>;
  persistCurrentSongId: (song: Song | null) => Promise<void>;
  isReady: boolean;
  setIsReady: Dispatch<SetStateAction<boolean>>;
  songs: Song[];
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

export const useMusicProviderEffects = ({
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  persistCurrentSongId,
  isReady,
  setIsReady,
  songs,
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
  useMusicHydration({
    songsRef,
    queueContextRef,
    baseQueueContextRef,
    nativeQueueRef,
    setIsReady,
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

  useMusicPersistence({
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
  });
};
