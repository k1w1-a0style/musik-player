import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { EqPresetName, Playlist, RepeatMode, Song } from '../types/Song';
import type { NativeHydrationGateOwner } from '../utils/nativeHydrationGate';

export interface StoredMusicHydrationState {
  songs: Song[] | null;
  playlists: Playlist[] | null;
  eqEnabled: boolean | null;
  eqBands: number[] | null;
  eqPreset: EqPresetName | 'custom' | null;
  volume: number | null;
  repeatMode: RepeatMode | null;
  shuffle: boolean | null;
  currentSongId: string | null;
}

export interface ApplyStoredPlaybackSettingsArgs {
  stored: StoredMusicHydrationState;
  setEqEnabledState: Dispatch<SetStateAction<boolean>>;
  setEqBandsState: Dispatch<SetStateAction<number[]>>;
  setEqPreset: Dispatch<SetStateAction<EqPresetName | 'custom'>>;
  setVolumeState: Dispatch<SetStateAction<number>>;
  setRepeatMode: Dispatch<SetStateAction<RepeatMode>>;
  setShuffle: Dispatch<SetStateAction<boolean>>;
}

export interface HydrateStoredSongsArgs {
  stored: StoredMusicHydrationState;
  songsRef: MutableRefObject<Song[]>;
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  nativeQueueRef: MutableRefObject<Song[]>;
  setSongsState: Dispatch<SetStateAction<Song[]>>;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  setPlaybackQueue: Dispatch<SetStateAction<Song[]>>;
  isCancelled: () => boolean;
  onLibraryHydrated?: (playlists: Playlist[]) => void;
  beforeNativeHydration?: () => Promise<void>;
}

export interface RunMusicHydrationArgs extends Omit<HydrateStoredSongsArgs, 'stored'>, Omit<ApplyStoredPlaybackSettingsArgs, 'stored'> {
  setIsReady: Dispatch<SetStateAction<boolean>>;
  setPlaylists: Dispatch<SetStateAction<Playlist[]>>;
  beforeStorageHydration?: () => Promise<void>;
  setLibraryHydrationReady?: Dispatch<SetStateAction<boolean>>;
  setHydrationStatus?: Dispatch<SetStateAction<'loading' | 'ready' | 'degraded' | 'retry-required'>>;
  gateOwner?: NativeHydrationGateOwner;
}
