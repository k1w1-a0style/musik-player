import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Song } from '../types/Song';
import { getNativePlaybackIntent, recordNativePlaybackIntent } from '../utils/nativePlaybackIntent';
import { enqueuePlaybackIntent } from '../utils/playbackIntentScheduler';
import { withPlaybackSelectionFeedback } from '../utils/playbackSelectionStatus';
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
  const playBatchRef = useRef({ latest: 0 });
  const enqueueQueueAction = useCallback((
    action: (hydrationCapture: NativeHydrationCapture, playbackIntentRevision: number) => Promise<NativeQueueActionResult>,
    playIntent = false,
  ): Promise<NativeQueueActionResult> => {
    // Queue edits keep their ordering. Only consecutive pending track choices
    // share a batch in which the newest target supersedes older choices.
    if (!playIntent) playBatchRef.current = { latest: 0 };
    const hydrationCapture = captureRequiredNativeHydration();
    if (hydrationCapture === null) {
      return Promise.resolve({ status: 'failed', error: new NativeMutationHydrationStaleError() });
    }
    const playbackIntentRevision = getNativePlaybackIntent().revision;
    return enqueuePlaybackIntent(() => action(hydrationCapture, playbackIntentRevision), playIntent ? 'selection' : 'edit');
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
      const playbackIntentRevision = captureRequiredNativeHydration() !== null
        ? recordNativePlaybackIntent('playing').revision : undefined;
      const batch = playBatchRef.current;
      const intent = ++batch.latest;
      return withPlaybackSelectionFeedback(playbackIntentRevision === undefined ? null : song,
        () => enqueueQueueAction(hydrationCapture => intent !== batch.latest
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
          playbackIntentRevision,
      }), true));
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
  const toggleShuffle = useCallback(async () => enqueueQueueAction((hydrationCapture, playbackIntentRevision) => runShuffleQueueAction({
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
    playbackIntentRevision,
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
