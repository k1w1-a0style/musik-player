import type { Dispatch, SetStateAction } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { EqPresetName, Playlist, RepeatMode, Song } from '../types/Song';
import { toTrackPlayerRepeatMode } from '../utils/audioPlaybackModes';
import { StorageKeys, storage } from '../utils/storage';

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

export const loadStoredMusicHydrationState = async (): Promise<StoredMusicHydrationState> => {
  const [
    songs,
    playlists,
    eqEnabled,
    eqBands,
    eqPreset,
    volume,
    repeatMode,
    shuffle,
    currentSongId,
  ] = await Promise.all([
    storage.get<Song[]>(StorageKeys.SONGS),
    storage.get<Playlist[]>(StorageKeys.PLAYLISTS),
    storage.get<boolean>(StorageKeys.EQ_ENABLED),
    storage.get<number[]>(StorageKeys.EQ_BANDS),
    storage.get<EqPresetName | 'custom'>(StorageKeys.EQ_PRESET),
    storage.get<number>(StorageKeys.VOLUME),
    storage.get<RepeatMode>(StorageKeys.REPEAT_MODE),
    storage.get<boolean>(StorageKeys.SHUFFLE),
    storage.get<string>(StorageKeys.CURRENT_SONG_ID),
  ]);

  return {
    songs,
    playlists,
    eqEnabled,
    eqBands,
    eqPreset,
    volume,
    repeatMode,
    shuffle,
    currentSongId,
  };
};

export const applyStoredPlaybackSettings = ({
  stored,
  setPlaylists,
  setEqEnabledState,
  setEqBandsState,
  setEqPreset,
  setVolumeState,
  setRepeatMode,
  setShuffle,
}: ApplyStoredPlaybackSettingsArgs): void => {
  if (stored.playlists) setPlaylists(stored.playlists);
  if (stored.eqEnabled != null) setEqEnabledState(stored.eqEnabled);
  if (stored.eqBands) setEqBandsState(stored.eqBands);
  if (stored.eqPreset) setEqPreset(stored.eqPreset);
  if (stored.volume != null) {
    setVolumeState(stored.volume);
    TrackPlayer.setVolume(stored.volume).catch(() => undefined);
  }
  if (stored.repeatMode) {
    setRepeatMode(stored.repeatMode);
    TrackPlayer.setRepeatMode(toTrackPlayerRepeatMode(stored.repeatMode)).catch(() => undefined);
  }
  if (stored.shuffle != null) setShuffle(stored.shuffle);
};
