import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { Song } from '../types/Song';
import {
  buildPlaySongQueuePlan,
  buildShuffleTogglePlan,
} from '../utils/playbackPlan';
import {
  applyPlaybackQueueState,
  getCurrentQueueSnapshot,
  persistRequestedSongId,
  rebuildNativePlaybackQueue,
} from './playbackQueueActionHelpers';

const trackPlayerWithSkip = TrackPlayer as typeof TrackPlayer & {
  skip?: (index: number, initialPosition?: number) => Promise<void>;
};

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
      const sourceQueue = queue && queue.length > 0 ? queue : songsRef.current;
      const plan = buildPlaySongQueuePlan(song, sourceQueue, nativeQueueRef.current);
      if (!plan) return;

      const { requestedSong, queueWithRequested, nativeIndex, canReuseNativeQueue } = plan;

      if (canReuseNativeQueue && trackPlayerWithSkip.skip) {
        const orderedQueue = plan.reusableOrderedQueue;
        applyPlaybackQueueState({
          queueContextRef,
          baseQueueContextRef,
          setPlaybackQueue,
          setCurrentSong,
          orderedQueue,
          baseQueue: nativeQueueRef.current,
          selectedSong: requestedSong,
        });

        try {
          const activeTrack = await TrackPlayer.getActiveTrack();
          if (activeTrack?.id !== requestedSong.id) {
            await trackPlayerWithSkip.skip(nativeIndex);
          }
          await TrackPlayer.play();
          await persistRequestedSongId(requestedSong, songsRef.current);
          return;
        } catch {
          // Fall through to a full queue rebuild if native skip is unavailable/fails.
        }
      }

      const orderedQueue = plan.rebuildOrderedQueue;
      applyPlaybackQueueState({
        queueContextRef,
        baseQueueContextRef,
        setPlaybackQueue,
        setCurrentSong,
        orderedQueue,
        baseQueue: queueWithRequested,
        selectedSong: requestedSong,
      });

      await rebuildNativePlaybackQueue(orderedQueue, nativeQueueRef);
      await persistRequestedSongId(requestedSong, songsRef.current);
    },
    [baseQueueContextRef, nativeQueueRef, queueContextRef, setCurrentSong, setPlaybackQueue, songsRef],
  );

  const toggleShuffle = useCallback(async () => {
    const currentQueue = getCurrentQueueSnapshot(queueContextRef.current, songsRef.current);
    const current = await TrackPlayer.getActiveTrack();
    const activeSongId = current?.id ?? currentSongId;
    const plan = buildShuffleTogglePlan({
      currentQueue,
      baseQueue: baseQueueContextRef.current,
      currentSongId: activeSongId,
      shuffleEnabled: shuffle,
    });
    if (!plan) return;

    const { nextQueue, nextBaseQueue, selectedSong } = plan;
    applyPlaybackQueueState({
      queueContextRef,
      baseQueueContextRef,
      setPlaybackQueue,
      setCurrentSong,
      orderedQueue: nextQueue.slice(),
      baseQueue: nextBaseQueue,
      selectedSong,
    });
    setShuffle(prev => !prev);

    try {
      const pos = await TrackPlayer.getProgress();
      await rebuildNativePlaybackQueue(nextQueue, nativeQueueRef, pos.position);
    } catch {
      // ignore shuffle queue rebuild failures
    }
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
