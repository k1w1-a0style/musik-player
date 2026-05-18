import type { Song } from '../types/Song';
import { moveSongToFront, shuffleQueueKeepingCurrent } from './playbackQueue';

export interface HydratedPlaybackQueue {
  hydratedQueue: Song[];
  orderedQueue: Song[];
  restoredSong?: Song;
  shouldClearPersistedCurrentSongId: boolean;
}

export const buildHydratedPlaybackQueue = (
  songs: Song[],
  currentSongId?: string | null,
  shuffle = false,
): HydratedPlaybackQueue => {
  const hydratedQueue = songs.filter(song => !!song.uri);
  const restoredSong = currentSongId
    ? hydratedQueue.find(song => song.id === currentSongId)
    : undefined;
  const orderedQueue = shuffle
    ? shuffleQueueKeepingCurrent(hydratedQueue, restoredSong?.id)
    : moveSongToFront(hydratedQueue, restoredSong?.id);

  return {
    hydratedQueue,
    orderedQueue,
    restoredSong,
    shouldClearPersistedCurrentSongId: !!currentSongId && !restoredSong,
  };
};

export const didSongCoversChange = (nextSongs: Song[], previousSongs: Song[]): boolean =>
  nextSongs.some((song, index) => song.cover !== previousSongs[index]?.cover);
