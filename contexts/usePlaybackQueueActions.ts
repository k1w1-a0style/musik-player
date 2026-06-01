import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Song } from '../types/Song';
import {
  runPlaySongQueueAction,
  runShuffleQueueAction,
} from './playbackQueueActionHelpers';

export interface PlaybackQueueActionsArgs {
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

export interface PlaybackQueueActions {
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
  const queueActionLockRef = useRef<Promise<void>>(Promise.resolve());
  const shuffleRef = useRef(shuffle);
  shuffleRef.current = shuffle;

  const enqueueQueueAction = useCallback((action: () => Promise<void>): Promise<void> => {
    const run = queueActionLockRef.current.catch(() => undefined).then(action);
    queueActionLockRef.current = run.catch(() => undefined);
    return run;
  }, []);

  const playSong = useCallback(
    async (song: Song, queue?: Song[]) => enqueueQueueAction(() => runPlaySongQueueAction({
      song,
      queue,
      songsRef,
      queueContextRef,
      baseQueueContextRef,
      nativeQueueRef,
      setPlaybackQueue,
      setCurrentSong,
    })),
    [baseQueueContextRef, enqueueQueueAction, nativeQueueRef, queueContextRef, setCurrentSong, setPlaybackQueue, songsRef],
  );

  const toggleShuffle = useCallback(async () => enqueueQueueAction(() => runShuffleQueueAction({
    songsRef,
    queueContextRef,
    baseQueueContextRef,
    nativeQueueRef,
    setPlaybackQueue,
    setCurrentSong,
    currentSongId,
    shuffle,
    shuffleRef,
    setShuffle,
  })), [
    baseQueueContextRef,
    currentSongId,
    enqueueQueueAction,
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