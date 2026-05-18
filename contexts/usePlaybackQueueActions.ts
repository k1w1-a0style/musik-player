import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Song } from '../types/Song';
import {
  persistRequestedSongId,
  runPlaySongQueueAction,
  runShuffleQueueAction,
} from './playbackQueueActionHelpers';

interface PlaybackQueueActionsArgs {
  songsRef: MutableRefObject<Song[]>;
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  nativeQueueRef: MutableRefObject<Song[]>;
  setPlaybackQueue: Dispatch<SetStateAction<Song[]>>;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  currentSongId?: string;
  shuffle: boolean;
  setShuffle: Dispatch<SetStateAction<boolean>>;
}

interface PlaybackQueueActions {
  playSong: (song: Song, queue?: Song[]) => Promise<void>;
  toggleShuffle: () => Promise<void>;
}

export { persistRequestedSongId } from './playbackQueueActionHelpers';

export const usePlaybackQueueActions = ({
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  setPlaybackQueue,
  setCurrentSong,
  currentSongId,
  shuffle,
  setShuffle,
}: PlaybackQueueActionsArgs): PlaybackQueueActions => {
  const playSong = useCallback(
    async (song: Song, queue?: Song[]) => {
      await runPlaySongQueueAction({
        song,
        queue,
        songsRef,
        queueContextRef,
        baseQueueContextRef,
        nativeQueueRef,
        setPlaybackQueue,
        setCurrentSong,
      });
    },
    [baseQueueContextRef, nativeQueueRef, queueContextRef, setCurrentSong, setPlaybackQueue, songsRef],
  );

  const toggleShuffle = useCallback(async () => {
    await runShuffleQueueAction({
      songsRef,
      queueContextRef,
      baseQueueContextRef,
      nativeQueueRef,
      setPlaybackQueue,
      setCurrentSong,
      currentSongId,
      shuffle,
      setShuffle,
    });
  }, [
    baseQueueContextRef,
    currentSongId,
    nativeQueueRef,
    queueContextRef,
    setCurrentSong,
    setPlaybackQueue,
    setShuffle,
    shuffle,
    songsRef,
  ]);

  return { playSong, toggleShuffle };
};
