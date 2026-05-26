import type { Song } from '../types/Song';
import { moveSongToFront, shuffleQueueKeepingCurrent } from './playbackQueue';
import { asPlayableSong, toPlayableSongs, type PlayableSong } from './playableSong';

export interface HydratedPlaybackQueue {
  hydratedQueue: PlayableSong[];
  orderedQueue: PlayableSong[];
  restoredSong?: PlayableSong;
  shouldClearPersistedCurrentSongId: boolean;
}

export const buildHydratedPlaybackQueue = (
  songs: Song[],
  currentSongId?: string | null,
  shuffle = false,
): HydratedPlaybackQueue => {
  const hydratedQueue = songs.flatMap(song => {
    if (!song.id?.trim()) return [];
    const playableSong = asPlayableSong(song);
    return playableSong ? [playableSong] : [];
  });

  const restoredSong = currentSongId
    ? hydratedQueue.find(song => song.id === currentSongId)
    : undefined;
  const orderedQueueUnnormalized = shuffle
    ? shuffleQueueKeepingCurrent(hydratedQueue, restoredSong?.id ?? currentSongId)
    : moveSongToFront(hydratedQueue, restoredSong?.id ?? currentSongId);
  const orderedQueue = toPlayableSongs(orderedQueueUnnormalized);

  return {
    hydratedQueue,
    orderedQueue,
    restoredSong,
    shouldClearPersistedCurrentSongId: !!currentSongId && !restoredSong,
  };
};

export const didSongCoversChange = (nextSongs: Song[], previousSongs: Song[]): boolean =>
  nextSongs.some((song, index) => song.cover !== previousSongs[index]?.cover);
