import type { Song } from '../types/Song';

export const buildNowPlayingQueue = (
  playbackQueue: Song[],
  currentSong: Song | null,
): Song[] => {
  if (playbackQueue.length > 0) return playbackQueue;
  return currentSong ? [currentSong] : [];
};

export const buildQueueById = (queue: Song[]): Map<string, Song> =>
  new Map(queue.map(song => [song.id, song]));
