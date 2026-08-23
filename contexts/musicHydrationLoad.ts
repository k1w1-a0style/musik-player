import { migrateLegacySongFavoritesFromStoredSongs, StorageKeys, storage } from '../utils/storage';
import type { StoredMusicHydrationState } from './musicHydrationTypes';

export const loadStoredMusicHydrationState = async (): Promise<StoredMusicHydrationState> => {
  // Favorite flags live inside the legacy monolithic song value. Finish that
  // one-time extraction before the song library migrates to chunked storage.
  await migrateLegacySongFavoritesFromStoredSongs();
  const storedState = [
    storage.get(StorageKeys.SONGS),
    storage.get(StorageKeys.PLAYLISTS),
    storage.get(StorageKeys.EQ_ENABLED),
    storage.get(StorageKeys.EQ_BANDS),
    storage.get(StorageKeys.EQ_PRESET),
    storage.get(StorageKeys.VOLUME),
    storage.get(StorageKeys.REPEAT_MODE),
    storage.get(StorageKeys.SHUFFLE),
    storage.get(StorageKeys.CURRENT_SONG_ID),
  ] as const;
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
  ] = await Promise.all(storedState);

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
