import type { Song } from '../types/Song';
import { moveSongToFront, shuffleQueueKeepingCurrent } from './playbackQueue';
import { asPlayableSong, toPlayableSongs, type PlayableSong } from './playableSong';

export interface HydratedPlaybackQueue {
  hydratedQueue: PlayableSong[];
  orderedQueue: PlayableSong[];
  restoredSong?: PlayableSong;
  shouldClearPersistedCurrentSongId: boolean;
}

const normalizeSongId = (songId?: string | null): string | undefined => {
  const trimmed = songId?.trim();
  return trimmed || undefined;
};

export const buildHydratedPlaybackQueue = (
  songs: Song[],
  currentSongId?: string | null,
  shuffle = false,
): HydratedPlaybackQueue => {
  const hydratedQueue = songs.flatMap(song => {
    const normalizedId = normalizeSongId(song.id);
    if (!normalizedId) return [];
    const normalizedSong = song.id === normalizedId ? song : { ...song, id: normalizedId };
    const playableSong = asPlayableSong(normalizedSong);
    return playableSong ? [playableSong] : [];
  });
  const normalizedCurrentSongId = normalizeSongId(currentSongId);
  const restoredSong = normalizedCurrentSongId
    ? hydratedQueue.find(song => song.id === normalizedCurrentSongId)
    : undefined;
  const orderedQueueUnnormalized = shuffle
    ? shuffleQueueKeepingCurrent(hydratedQueue, restoredSong?.id ?? normalizedCurrentSongId)
    : moveSongToFront(hydratedQueue, restoredSong?.id ?? normalizedCurrentSongId);
  const orderedQueue = toPlayableSongs(orderedQueueUnnormalized);

  return {
    hydratedQueue,
    orderedQueue,
    restoredSong,
    shouldClearPersistedCurrentSongId: !!normalizedCurrentSongId && !restoredSong,
  };
};

export const didSongCoversChange = (nextSongs: Song[], previousSongs: Song[]): boolean =>
  nextSongs.some((song, index) => song.cover !== previousSongs[index]?.cover);
