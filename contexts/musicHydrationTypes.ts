import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { EqPresetName, Playlist, RepeatMode, Song } from '../types/Song';

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
  setPlaylists: Dispatch<SetStateAction<Playlist[]>>;
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
}

export interface RunMusicHydrationArgs extends Omit<HydrateStoredSongsArgs, 'stored'>, Omit<ApplyStoredPlaybackSettingsArgs, 'stored'> {
  setIsReady: Dispatch<SetStateAction<boolean>>;
}
