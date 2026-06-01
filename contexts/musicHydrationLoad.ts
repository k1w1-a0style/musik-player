import type { EqPresetName, Playlist, RepeatMode, Song } from '../types/Song';
import { migrateLegacySongFavoritesFromStoredSongs, StorageKeys, storage } from '../utils/storage';
import type { StoredMusicHydrationState } from './musicHydrationTypes';

export const loadStoredMusicHydrationState = async (): Promise<StoredMusicHydrationState> => {
  await migrateLegacySongFavoritesFromStoredSongs();
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
