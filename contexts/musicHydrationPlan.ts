import type { Playlist, Song } from '../types/Song';
import {
  buildHydratedPlaybackQueue,
  didSongCoversChange,
  normalizeHydrationSongs,
  normalizePlaylistsForHydratedSongs,
} from '../utils/musicHydration';
import { toPlayableSongs, type PlayableSong } from '../utils/playableSong';
import { prunePlaylists, sanitizePlaylists } from '../utils/playlistState';
import type { StoredMusicHydrationState } from './musicHydrationTypes';

export type CurrentSongPersistencePlan =
  | { action: 'keep' }
  | { action: 'set'; songId: string }
  | { action: 'remove'; songId?: string; reason: 'missing-or-not-playable' };

export type NativeQueueHydrationAction = 'initialize' | 'clear' | 'clearMalformedCurrent' | 'none';

export interface HydrationPlan {
  hydratedSongs: Song[];
  songsWereNormalized: boolean;
  shouldPersistSongs: boolean;
  normalizedPlaylists: Playlist[] | null;
  shouldPersistPlaylists: boolean;
  hydratedQueue: PlayableSong[];
  playableQueue: PlayableSong[];
  restoredSong: PlayableSong | null;
  resolvedCurrentSongId: string | null;
  currentSongPersistence: CurrentSongPersistencePlan;
  nativeQueueAction: NativeQueueHydrationAction;
}

export const sanitizeStoredPlaylistsForHydration = (stored: StoredMusicHydrationState): Playlist[] | null => {
  if (!stored.playlists) return null;
  if (!stored.songs) return sanitizePlaylists(stored.playlists);
  return prunePlaylists(stored.playlists, new Set(stored.songs.map(song => song.id)));
};

const planCurrentSongPersistence = (
  storedCurrentSongId: string | null,
  resolvedCurrentSongId: string | undefined,
  shouldClearPersistedCurrentSongId: boolean,
  fallbackSongId?: string,
): CurrentSongPersistencePlan => {
  if (resolvedCurrentSongId) {
    return storedCurrentSongId !== resolvedCurrentSongId
      ? { action: 'set', songId: resolvedCurrentSongId }
      : { action: 'keep' };
  }

  if (shouldClearPersistedCurrentSongId) {
    return { action: 'remove', songId: fallbackSongId ?? undefined, reason: 'missing-or-not-playable' };
  }

  return { action: 'keep' };
};

const planNativeQueueAction = (
  currentSongPersistence: CurrentSongPersistencePlan,
  resolvedCurrentSongId: string | null,
  playableQueue: PlayableSong[],
): NativeQueueHydrationAction => {
  if (currentSongPersistence.action === 'remove') return 'clearMalformedCurrent';
  if (!resolvedCurrentSongId && playableQueue.length > 0) return 'none';
  if (playableQueue.length === 0) return 'clear';
  return 'initialize';
};

export const createHydrationPlan = (
  stored: StoredMusicHydrationState,
  sanitizedSongs: Song[],
): HydrationPlan => {
  const { songs: hydratedSongs, changed: songsWereNormalized } = normalizeHydrationSongs(sanitizedSongs);
  const shouldPersistSongs = didSongCoversChange(hydratedSongs, stored.songs ?? []) || songsWereNormalized;
  const playbackQueue = buildHydratedPlaybackQueue(
    hydratedSongs,
    stored.currentSongId,
    stored.shuffle ?? false,
  );
  const playableQueue = toPlayableSongs(playbackQueue.orderedQueue);
  const normalizedPlaylists = stored.playlists
    ? normalizePlaylistsForHydratedSongs(stored.playlists, hydratedSongs)
    : null;
  const shouldPersistPlaylists = normalizedPlaylists != null && normalizedPlaylists !== stored.playlists;
  const restoredSong = playbackQueue.restoredSong
    ? playableQueue.find(song => song.id === playbackQueue.restoredSong?.id) ?? null
    : null;
  const resolvedCurrentSongId = restoredSong?.id ?? null;
  const currentSongPersistence = planCurrentSongPersistence(
    stored.currentSongId,
    resolvedCurrentSongId ?? undefined,
    playbackQueue.shouldClearPersistedCurrentSongId,
    playbackQueue.normalizedCurrentSongId ?? stored.currentSongId ?? undefined,
  );

  return {
    hydratedSongs,
    songsWereNormalized,
    shouldPersistSongs,
    normalizedPlaylists,
    shouldPersistPlaylists,
    hydratedQueue: playbackQueue.hydratedQueue,
    playableQueue,
    restoredSong,
    resolvedCurrentSongId,
    currentSongPersistence,
    nativeQueueAction: planNativeQueueAction(currentSongPersistence, resolvedCurrentSongId, playableQueue),
  };
};

export const applyHydrationPlanToStoredState = (
  stored: StoredMusicHydrationState,
  plan: HydrationPlan,
): StoredMusicHydrationState => ({
  ...stored,
  songs: plan.hydratedSongs,
  playlists: plan.normalizedPlaylists,
  currentSongId: plan.currentSongPersistence.action === 'remove'
    ? null
    : plan.resolvedCurrentSongId ?? (plan.playableQueue.length > 0 ? stored.currentSongId : null),
});
