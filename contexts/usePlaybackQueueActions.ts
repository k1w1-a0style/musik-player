import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Song } from '../types/Song';
import {
  captureRequiredNativeHydration,
  NativeMutationHydrationStaleError,
  type NativeHydrationCapture,
} from '../utils/nativeQueueMutationLock';
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

const useQueueActionScheduler = () => {
  const queueActionLockRef = useRef<Promise<void>>(Promise.resolve());
  const playBatchRef = useRef({ latest: 0 });
  const enqueueQueueAction = useCallback((
    action: (hydrationCapture: NativeHydrationCapture) => Promise<NativeQueueActionResult>,
    playIntent = false,
  ): Promise<NativeQueueActionResult> => {
    // Queue edits keep their ordering. Only consecutive pending track choices
    // share a batch in which the newest target supersedes older choices.
    if (!playIntent) playBatchRef.current = { latest: 0 };
    const hydrationCapture = captureRequiredNativeHydration();
    if (hydrationCapture === null) {
      return Promise.resolve({ status: 'failed', error: new NativeMutationHydrationStaleError() });
    }
    const run = queueActionLockRef.current.catch(() => undefined).then(() => action(hydrationCapture));
    queueActionLockRef.current = run.then(() => undefined, () => undefined);
    return run;
  }, []);
  return { playBatchRef, enqueueQueueAction };
};

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
  const { playBatchRef, enqueueQueueAction } = useQueueActionScheduler();
  const shuffleRef = useRef(shuffle);
  shuffleRef.current = shuffle;
  const playSong = useCallback(
    async (song: Song, queue?: Song[]) => {
      const batch = playBatchRef.current;
      const intent = ++batch.latest;
      return enqueueQueueAction(hydrationCapture => intent !== batch.latest
        ? Promise.resolve({ status: 'stale' as const }) : runPlaySongQueueAction({
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
          hydrationCapture,
      }), true);
    },
    [baseQueueContextRef, enqueueQueueAction, nativeQueueRef, playBatchRef, queueContextRef, setCurrentSong, setPlaybackQueue, setShuffle, shuffle, songsRef],
  );

  const insertSongIntoQueue = useCallback(
    async (song: Song, position: 'next' | 'end') => enqueueQueueAction(hydrationCapture => runInsertSongQueueAction({
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
          hydrationCapture,
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
  const toggleShuffle = useCallback(async () => enqueueQueueAction(hydrationCapture => runShuffleQueueAction({
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
    hydrationCapture,
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
    async (fromIndex: number, toIndex: number) => enqueueQueueAction(hydrationCapture => runReorderQueueAction({
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
          hydrationCapture,
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
