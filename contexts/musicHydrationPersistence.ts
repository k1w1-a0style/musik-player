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
