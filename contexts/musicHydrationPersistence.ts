import type { Playlist } from '../types/Song';
import { StorageKeys, storage } from '../utils/storage';
import type { HydrationPlan } from './musicHydrationPlan';

export const persistHydratedSongsIfNeeded = async (plan: HydrationPlan): Promise<void> => {
  if (!plan.shouldPersistSongs) return;
  const stored = await storage.set(StorageKeys.SONGS, plan.hydratedSongs);
  if (!stored) throw new Error('Failed to persist hydrated songs.');
};

export const persistHydratedPlaylistsIfNeeded = async (plan: HydrationPlan): Promise<void> => {
  if (plan.shouldPersistPlaylists && plan.normalizedPlaylists) {
    await storage.set(StorageKeys.PLAYLISTS, plan.normalizedPlaylists);
  }
};

export const persistHydratedCurrentSongIdIfNeeded = async (plan: HydrationPlan): Promise<void> => {
  if (plan.currentSongPersistence.action === 'set') {
    await storage.set(StorageKeys.CURRENT_SONG_ID, plan.currentSongPersistence.songId);
    return;
  }

  if (plan.currentSongPersistence.action === 'remove') {
    console.warn('[MusicHydration] Restored current song is not playable; clearing persisted current song id.', {
      songId: plan.currentSongPersistence.songId,
    });
    await storage.remove(StorageKeys.CURRENT_SONG_ID);
  }
};

export const persistSanitizedPlaylistsInBackground = (playlists: Playlist[]): void => {
  void storage.set(StorageKeys.PLAYLISTS, playlists).catch(error => {
    console.warn('[MusicHydration] Failed to persist sanitized playlists.', error);
  });
};

export const clearPersistedCurrentSongIdAfterFailure = (): void => {
  void storage.remove(StorageKeys.CURRENT_SONG_ID).catch(removeError => {
    console.warn('[MusicHydration:StorageError] Failed to clear current song id after hydration failure.', removeError);
  });
};
