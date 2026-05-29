import type { Playlist, Song } from '../types/Song';
import { moveSongToFront, shuffleQueueKeepingCurrent } from './playbackQueue';
import { asPlayableSong, toPlayableSongs, type PlayableSong } from './playableSong';


const normalizeHydrationId = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

const normalizeSongForHydration = (song: Song): Song | null => {
  const id = normalizeHydrationId(song.id);
  if (!id) return null;
  if (song.id === id) return song;
  return { ...song, id };
};

export interface NormalizeHydrationSongsResult {
  songs: Song[];
  changed: boolean;
}

export const normalizeHydrationSongs = (songs: Song[]): NormalizeHydrationSongsResult => {
  let changed = false;
  const normalizedSongIndexes = new Map<string, { index: number; playable: boolean }>();
  const normalizedSongs: Song[] = [];

  songs.forEach(song => {
    const normalizedSong = normalizeSongForHydration(song);
    if (!normalizedSong) {
      changed = true;
      return;
    }
    if (normalizedSong !== song) changed = true;

    const playable = asPlayableSong(normalizedSong) != null;
    const existing = normalizedSongIndexes.get(normalizedSong.id);
    if (existing) {
      changed = true;
      if (!existing.playable && playable) {
        normalizedSongs[existing.index] = normalizedSong;
        normalizedSongIndexes.set(normalizedSong.id, { index: existing.index, playable });
        console.warn('[MusicHydration] Replacing duplicated normalized song id with playable song during hydration.', {
          songId: normalizedSong.id,
          title: normalizedSong.title || undefined,
        });
        return;
      }

      console.warn('[MusicHydration] Dropping duplicated normalized song id during hydration.', {
        songId: normalizedSong.id,
        title: normalizedSong.title || undefined,
      });
      return;
    }

    normalizedSongIndexes.set(normalizedSong.id, { index: normalizedSongs.length, playable });
    normalizedSongs.push(normalizedSong);
  });

  return { songs: normalizedSongs, changed };
};

export const normalizePlaylistsForHydratedSongs = (playlists: Playlist[], songs: Song[]): Playlist[] => {
  if (playlists.length === 0) return playlists;
  const validSongIds = new Set(songs.map(song => song.id));
  let changed = false;
  let timestamp: number | undefined;
  const next = playlists.map(playlist => {
    const seen = new Set<string>();
    const songIds: string[] = [];
    playlist.songIds.forEach(songId => {
      const normalizedId = normalizeHydrationId(songId);
      if (!normalizedId) return;
      if (!validSongIds.has(normalizedId)) return;
      if (seen.has(normalizedId)) return;
      seen.add(normalizedId);
      songIds.push(normalizedId);
    });

    const unchanged = songIds.length === playlist.songIds.length && songIds.every((songId, index) => songId === playlist.songIds[index]);
    if (unchanged) return playlist;
    changed = true;
    timestamp ??= Date.now();
    return { ...playlist, songIds, updatedAt: timestamp };
  });
  return changed ? next : playlists;
};

export interface HydratedPlaybackQueue {
  hydratedQueue: PlayableSong[];
  orderedQueue: PlayableSong[];
  restoredSong?: PlayableSong;
  normalizedCurrentSongId?: string;
  hasPersistedCurrentSongId: boolean;
  shouldClearPersistedCurrentSongId: boolean;
}

export const buildHydratedPlaybackQueue = (
  songs: Song[],
  currentSongId?: string | null,
  shuffle = false,
): HydratedPlaybackQueue => {
  const hydratedQueue = songs.flatMap(song => {
    const normalizedSong = normalizeSongForHydration(song);
    if (!normalizedSong) return [];
    const playableSong = asPlayableSong(normalizedSong);
    return playableSong ? [playableSong] : [];
  });

  const normalizedCurrentSongId = normalizeHydrationId(currentSongId);
  const restoredSong = normalizedCurrentSongId
    ? hydratedQueue.find(song => song.id === normalizedCurrentSongId)
    : undefined;
  const orderedQueueUnnormalized = shuffle
    ? shuffleQueueKeepingCurrent(hydratedQueue, restoredSong?.id ?? normalizedCurrentSongId)
    : moveSongToFront(hydratedQueue, restoredSong?.id ?? normalizedCurrentSongId);
  const orderedQueue = toPlayableSongs(orderedQueueUnnormalized);

  const hasPersistedCurrentSongId = currentSongId != null;

  return {
    hydratedQueue,
    orderedQueue,
    restoredSong,
    normalizedCurrentSongId,
    hasPersistedCurrentSongId,
    shouldClearPersistedCurrentSongId: hasPersistedCurrentSongId && (!normalizedCurrentSongId || !restoredSong),
  };
};

export const didSongCoversChange = (nextSongs: Song[], previousSongs: Song[]): boolean =>
  nextSongs.some((song, index) => song.cover !== previousSongs[index]?.cover);
