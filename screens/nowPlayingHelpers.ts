import type { Song } from '../types/Song';

const HIDDEN_VISUALIZER_REASONS = new Set(['stopped', 'ok']);

export const formatVisualizerHint = (reason: string | null): string | null => {
  if (!reason || HIDDEN_VISUALIZER_REASONS.has(reason)) return null;
  if (reason === 'no_permission') return 'Visualizer deaktiviert (keine Mikrofonberechtigung).';
  return `Visualizer deaktiviert (${reason}).`;
};

export const buildNowPlayingQueue = (
  playbackQueue: Song[],
  currentSong: Song | null,
): Song[] => {
  if (playbackQueue.length > 0) return playbackQueue;
  return currentSong ? [currentSong] : [];
};

export const buildQueueById = (queue: Song[]): Map<string, Song> =>
  new Map(queue.map(song => [song.id, song]));
