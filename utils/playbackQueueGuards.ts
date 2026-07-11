import type { RepeatMode, Song } from '../types/Song';

interface CanSkipToNextInQueueInput {
  currentSong: Song | null | undefined;
  playbackQueue: Song[];
  repeatMode: RepeatMode;
}

export const canSkipToNextInQueue = ({
  currentSong,
  playbackQueue,
  repeatMode,
}: CanSkipToNextInQueueInput): boolean => {
  if (!currentSong || playbackQueue.length <= 1) {
    return false;
  }

  if (repeatMode === 'all') {
    return true;
  }

  const currentQueueIndex = playbackQueue.findIndex(item => item.id === currentSong.id);

  return currentQueueIndex < 0 || currentQueueIndex < playbackQueue.length - 1;
};
