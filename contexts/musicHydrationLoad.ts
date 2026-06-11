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
    storage.get(StorageKeys.SONGS),
    storage.get(StorageKeys.PLAYLISTS),
    storage.get(StorageKeys.EQ_ENABLED),
    storage.get(StorageKeys.EQ_BANDS),
    storage.get(StorageKeys.EQ_PRESET),
    storage.get(StorageKeys.VOLUME),
    storage.get(StorageKeys.REPEAT_MODE),
    storage.get(StorageKeys.SHUFFLE),
    storage.get(StorageKeys.CURRENT_SONG_ID),
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
