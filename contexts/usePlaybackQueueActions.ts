import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Song } from '../types/Song';
import {
  runInsertSongQueueAction,
  runPlaySongQueueAction,
  runReorderQueueAction,
  runShuffleQueueAction,
  type NativeQueueActionResult,
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
  playSong: (song: Song, queue?: Song[]) => Promise<NativeQueueActionResult>;
  toggleShuffle: () => Promise<NativeQueueActionResult>;
  playSongNext: (song: Song) => Promise<NativeQueueActionResult>;
  addSongToQueue: (song: Song) => Promise<NativeQueueActionResult>;
  reorderQueue?: (fromIndex: number, toIndex: number) => Promise<NativeQueueActionResult>;
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
  const enqueueQueueAction = useCallback(<T,>(action: () => Promise<T>): Promise<T> => {
    const run = queueActionLockRef.current.catch(() => undefined).then(action);
    queueActionLockRef.current = run.then(() => undefined, () => undefined);
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
      shuffle,
      shuffleRef,
      setShuffle,
    })),
    [baseQueueContextRef, enqueueQueueAction, nativeQueueRef, queueContextRef, setCurrentSong, setPlaybackQueue, setShuffle, shuffle, songsRef],
  );

  const insertSongIntoQueue = useCallback(
    async (song: Song, position: 'next' | 'end') => enqueueQueueAction(() => runInsertSongQueueAction({
          song,
          position,
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
        })),
    [baseQueueContextRef, currentSongId, enqueueQueueAction, nativeQueueRef, queueContextRef, setCurrentSong, setPlaybackQueue, setShuffle, shuffle, songsRef],
  );
  const playSongNext = useCallback(
    async (song: Song) => insertSongIntoQueue(song, 'next'),
    [insertSongIntoQueue],
  );
  const addSongToQueue = useCallback(
    async (song: Song) => insertSongIntoQueue(song, 'end'),
    [insertSongIntoQueue],
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
  const reorderQueue = useCallback(
    async (fromIndex: number, toIndex: number) => enqueueQueueAction(() => runReorderQueueAction({
          fromIndex,
          toIndex,
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
        })),
    [
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
    ],
  );

  return { playSong, playSongNext, addSongToQueue, toggleShuffle, reorderQueue };
};
