import type { Playlist } from '../types/Song';
import {
  assertCurrentSongPersistenceSucceeded,
  persistCurrentSongIdSerialized,
} from '../utils/currentSongPersistence';
import { StorageKeys, storage } from '../utils/storage';
import type { HydrationPlan } from './musicHydrationPlan';

export type HydratedSongsPersistResult =
  | { status: 'not-needed' }
  | { status: 'confirmed' }
  | { status: 'unconfirmed'; error?: unknown };

export const persistHydratedSongsIfNeeded = async (plan: HydrationPlan): Promise<HydratedSongsPersistResult> => {
  if (!plan.shouldPersistSongs) return { status: 'not-needed' };
  try {
    const stored = await storage.set(StorageKeys.SONGS, plan.hydratedSongs);
    return stored ? { status: 'confirmed' } : { status: 'unconfirmed' };
  } catch (error) {
    return { status: 'unconfirmed', error };
  }
};

export const persistHydratedPlaylistsIfNeeded = async (plan: HydrationPlan): Promise<void> => {
  if (plan.shouldPersistPlaylists && plan.normalizedPlaylists) {
    await storage.set(StorageKeys.PLAYLISTS, plan.normalizedPlaylists);
  }
};

export const persistHydratedCurrentSongIdIfNeeded = async (plan: HydrationPlan): Promise<void> => {
  if (plan.currentSongPersistence.action === 'keep') return;

  if (plan.currentSongPersistence.action === 'remove') {
    console.warn('[MusicHydration] Restored current song is not playable; clearing persisted current song id.', {
      songId: plan.currentSongPersistence.songId,
    });
  }

  const desiredId = plan.currentSongPersistence.action === 'set'
    ? plan.currentSongPersistence.songId
    : null;
  const result = await persistCurrentSongIdSerialized({
    resolveDesiredId: () => desiredId,
  });
  assertCurrentSongPersistenceSucceeded(result);
};

export const persistSanitizedPlaylistsInBackground = (playlists: Playlist[]): void => {
  void storage.set(StorageKeys.PLAYLISTS, playlists).catch(error => {
    console.warn('[MusicHydration] Failed to persist sanitized playlists.', error);
  });
};
