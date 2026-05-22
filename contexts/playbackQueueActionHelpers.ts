import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
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

interface ApplyPlaybackQueueStateArgs {
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  setPlaybackQueue: Dispatch<SetStateAction<Song[]>>;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  orderedQueue: Song[];
  baseQueue: Song[];
  selectedSong?: Song;
}

interface PlaybackQueueActionRefs {
  songsRef: MutableRefObject<Song[]>;
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  nativeQueueRef: MutableRefObject<Song[]>;
  setPlaybackQueue: Dispatch<SetStateAction<Song[]>>;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
}

export interface RunPlaySongQueueActionArgs extends PlaybackQueueActionRefs {
  song: Song;
  queue?: Song[];
}

export interface RunShuffleQueueActionArgs extends PlaybackQueueActionRefs {
  currentSongId?: string;
  shuffle: boolean;
  setShuffle: Dispatch<SetStateAction<boolean>>;
}

const normalizeSongId = (songId?: string): string | undefined => {
  const trimmed = songId?.trim();
  return trimmed || undefined;
};

const isPlayableSong = (song: Song): boolean => Boolean(song.uri?.trim());

export const getCurrentQueueSnapshot = (queueContext: Song[], librarySongs: Song[]): Song[] =>
  (queueContext.length > 0 ? queueContext : librarySongs.filter(isPlayableSong)).slice();

export const persistRequestedSongId = async (
  requestedSong: Song,
  librarySongs: Song[],
): Promise<void> => {
  const requestedSongId = normalizeSongId(requestedSong.id);
  if (!requestedSongId) {
    await storage.remove(StorageKeys.CURRENT_SONG_ID);
    return;
  }

  const isLibrarySong = librarySongs.some(item => normalizeSongId(item.id) === requestedSongId);
  if (isLibrarySong) {
    await storage.set(StorageKeys.CURRENT_SONG_ID, requestedSongId);
    return;
  }
  await storage.remove(StorageKeys.CURRENT_SONG_ID);
};

export const applyPlaybackQueueState = ({
  queueContextRef,
  baseQueueContextRef,
  setPlaybackQueue,
  setCurrentSong,
  orderedQueue,
  baseQueue,
  selectedSong,
}: ApplyPlaybackQueueStateArgs): void => {
  queueContextRef.current = orderedQueue.slice();
  baseQueueContextRef.current = baseQueue.slice();
  setPlaybackQueue(orderedQueue.slice());
  if (selectedSong) setCurrentSong(selectedSong);
};

export const rebuildNativePlaybackQueue = async (
  queue: Song[],
  nativeQueueRef: MutableRefObject<Song[]>,
  resumePositionSeconds?: number,
): Promise<void> => {
  nativeQueueRef.current = [];
  await TrackPlayer.reset();
  await TrackPlayer.add(queue.map(toTrackPlayerTrack));
  nativeQueueRef.current = queue.slice();
  if (resumePositionSeconds) await TrackPlayer.seekTo(resumePositionSeconds);
  await TrackPlayer.play();
};

export const runPlaySongQueueAction = async ({
  song,
  queue,
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  setPlaybackQueue,
  setCurrentSong,
}: RunPlaySongQueueActionArgs): Promise<void> => {
  const sourceQueue = queue && queue.length > 0 ? queue : songsRef.current;
  const plan = buildPlaySongQueuePlan(song, sourceQueue, nativeQueueRef.current);
  if (!plan) return;

  const { requestedSong, queueWithRequested, nativeIndex, canReuseNativeQueue } = plan;

  if (canReuseNativeQueue && trackPlayerWithSkip.skip) {
    const orderedQueue = plan.reusableOrderedQueue;

    try {
      const activeTrack = await TrackPlayer.getActiveTrack();
      if (activeTrack?.id !== requestedSong.id) {
        await trackPlayerWithSkip.skip(nativeIndex);
      }
      await TrackPlayer.play();
      applyPlaybackQueueState({
        queueContextRef,
        baseQueueContextRef,
        setPlaybackQueue,
        setCurrentSong,
        orderedQueue,
        baseQueue: nativeQueueRef.current,
        selectedSong: requestedSong,
      });
      await persistRequestedSongId(requestedSong, songsRef.current);
      return;
    } catch {
      // Fall through to a full queue rebuild if native skip is unavailable/fails.
    }
  }

  const orderedQueue = plan.rebuildOrderedQueue;
  await rebuildNativePlaybackQueue(orderedQueue, nativeQueueRef);
  applyPlaybackQueueState({
    queueContextRef,
    baseQueueContextRef,
    setPlaybackQueue,
    setCurrentSong,
    orderedQueue,
    baseQueue: queueWithRequested,
    selectedSong: requestedSong,
  });
  await persistRequestedSongId(requestedSong, songsRef.current);
};

export const runShuffleQueueAction = async ({
  currentSongId,
  shuffle,
  setShuffle,
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  setPlaybackQueue,
  setCurrentSong,
}: RunShuffleQueueActionArgs): Promise<void> => {
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

  try {
    const pos = await TrackPlayer.getProgress();
    await rebuildNativePlaybackQueue(nextQueue, nativeQueueRef, pos.position);
  } catch {
    nativeQueueRef.current = [];
    return;
  }

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
};