import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { Song } from '../types/Song';
import {
  buildPlaySongQueuePlan,
  buildShuffleTogglePlan,
} from '../utils/playbackPlan';
import { StorageKeys, storage } from '../utils/storage';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';

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

export const persistRequestedSongId = async (
  requestedSong: Song,
  librarySongs: Song[],
): Promise<void> => {
  const isLibrarySong = librarySongs.some(item => item.id === requestedSong.id);
  if (isLibrarySong) {
    await storage.set(StorageKeys.CURRENT_SONG_ID, requestedSong.id);
    return;
  }
  await storage.remove(StorageKeys.CURRENT_SONG_ID);
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
  const playSong = useCallback(
    async (song: Song, queue?: Song[]) => {
      const sourceQueue = queue && queue.length > 0 ? queue : songsRef.current;
      const plan = buildPlaySongQueuePlan(song, sourceQueue, nativeQueueRef.current);
      if (!plan) return;

      const { requestedSong, queueWithRequested, nativeIndex, canReuseNativeQueue } = plan;

      if (canReuseNativeQueue && trackPlayerWithSkip.skip) {
        const orderedQueue = plan.reusableOrderedQueue;
        queueContextRef.current = orderedQueue;
        baseQueueContextRef.current = nativeQueueRef.current.slice();
        setPlaybackQueue(orderedQueue);
        setCurrentSong(requestedSong);

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
      queueContextRef.current = orderedQueue;
      baseQueueContextRef.current = queueWithRequested.slice();
      nativeQueueRef.current = orderedQueue.slice();
      setPlaybackQueue(orderedQueue);

      setCurrentSong(requestedSong);
      await TrackPlayer.reset();
      await TrackPlayer.add(orderedQueue.map(toTrackPlayerTrack));
      await TrackPlayer.play();
      await persistRequestedSongId(requestedSong, songsRef.current);
    },
    [baseQueueContextRef, nativeQueueRef, queueContextRef, setCurrentSong, setPlaybackQueue, songsRef],
  );

  const toggleShuffle = useCallback(async () => {
    const currentQueue = (
      queueContextRef.current.length > 0
        ? queueContextRef.current
        : songsRef.current.filter(song => !!song.uri)
    ).slice();
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
    queueContextRef.current = nextQueue.slice();
    baseQueueContextRef.current = nextBaseQueue.slice();
    setPlaybackQueue(nextQueue.slice());
    if (selectedSong) setCurrentSong(selectedSong);
    setShuffle(prev => !prev);

    try {
      const pos = await TrackPlayer.getProgress();
      await TrackPlayer.reset();
      await TrackPlayer.add(nextQueue.map(toTrackPlayerTrack));
      nativeQueueRef.current = nextQueue.slice();
      if (pos.position) await TrackPlayer.seekTo(pos.position);
      await TrackPlayer.play();
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
