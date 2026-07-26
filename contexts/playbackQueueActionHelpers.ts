import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { Song } from '../types/Song';
import { isPlayableSong, toPlayableSongs, type PlayableSong } from '../utils/playableSong';
import {
  buildPlaySongQueuePlan,
  buildShuffleTogglePlan,
} from '../utils/playbackPlan';
import { buildQueueReorderPlan } from '../utils/queueReorder';
import { StorageKeys, storage } from '../utils/storage';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';
import {
  type NativeQueueReplacementContext,
  runExclusiveNativePlaybackControl,
  runExclusiveNativeQueueReplacement,
} from '../utils/nativeQueueMutationLock';

interface ApplyPlaybackQueueStateArgs {
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  setPlaybackQueue: Dispatch<SetStateAction<Song[]>>;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  orderedQueue: Song[];
  baseQueue: Song[];
  selectedSong?: Song;
}

type ShuffleQueueActionResult = 'applied' | 'failed' | 'stale';
type ReorderQueueActionResult = 'applied' | 'failed' | 'stale' | 'noop';
type InsertQueueActionResult = 'applied' | 'failed' | 'stale' | 'noop';

export class NativeQueueReplacementStaleError extends Error {
  constructor() {
    super('Native queue replacement was superseded.');
    this.name = 'NativeQueueReplacementStaleError';
  }
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
  shuffleRef?: MutableRefObject<boolean>;
  setShuffle: Dispatch<SetStateAction<boolean>>;
}

export interface RunInsertSongQueueActionArgs extends PlaybackQueueActionRefs {
  song: Song;
  currentSongId?: string;
  position: 'next' | 'end';
  shuffle: boolean;
  shuffleRef?: MutableRefObject<boolean>;
  setShuffle: Dispatch<SetStateAction<boolean>>;
}

export interface RunReorderQueueActionArgs extends PlaybackQueueActionRefs {
  fromIndex: number;
  toIndex: number;
  currentSongId?: string;
  shuffle: boolean;
  shuffleRef?: MutableRefObject<boolean>;
  setShuffle: Dispatch<SetStateAction<boolean>>;
}

const normalizeSongId = (songId?: string): string | undefined => {
  const trimmed = songId?.trim();
  return trimmed || undefined;
};

export const getCurrentQueueSnapshot = (queueContext: Song[], librarySongs: Song[]): Song[] =>
  (queueContext.length > 0 ? queueContext : librarySongs.filter(isPlayableSong)).slice();

const findSongByNormalizedId = (songs: Song[], songId?: string): Song | undefined => {
  const normalizedId = normalizeSongId(songId);
  return normalizedId ? songs.find(song => normalizeSongId(song.id) === normalizedId) : undefined;
};

const buildQueueWithInsertedSong = ({
  queue,
  song,
  insertIndex,
}: {
  queue: Song[];
  song: Song;
  insertIndex: number;
}): { queue: Song[]; insertIndex: number; changed: boolean } => {
  const insertedSongId = normalizeSongId(song.id);
  if (insertedSongId && queue.some(item => normalizeSongId(item.id) === insertedSongId)) {
    return { queue, insertIndex: -1, changed: false };
  }

  const safeInsertIndex = Math.max(0, Math.min(insertIndex, queue.length));
  const nextQueue = queue.slice();
  nextQueue.splice(safeInsertIndex, 0, song);
  return { queue: nextQueue, insertIndex: safeInsertIndex, changed: true };
};

const getNativeInsertIndex = ({
  nativeQueue,
  activeSongId,
  position,
}: {
  nativeQueue: Song[];
  activeSongId?: string;
  position: 'next' | 'end';
}): number => {
  if (position === 'end') return nativeQueue.length;

  const activeNativeIndex = nativeQueue.findIndex(song => normalizeSongId(song.id) === normalizeSongId(activeSongId));
  // Fallback: if TrackPlayer reports an active track that is not present in the
  // native queue ref, append instead of guessing from the rotated UI queue.
  return activeNativeIndex >= 0 ? activeNativeIndex + 1 : nativeQueue.length;
};

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

export const rebuildNativePlaybackQueueUnlocked = async (
  queue: PlayableSong[],
  nativeQueueRef: MutableRefObject<Song[]>,
  resumePositionSeconds?: number,
  replacementContext?: Pick<NativeQueueReplacementContext, 'isCurrent'>,
  startIndex = 0,
): Promise<boolean> => {
  const isCurrent = replacementContext?.isCurrent ?? (() => true);

  if (!isCurrent()) return false;
  await TrackPlayer.reset();
  nativeQueueRef.current = [];
  if (!isCurrent()) return false;

  if (queue.length > 0) {
    await TrackPlayer.add(queue.map(toTrackPlayerTrack));
    if (!isCurrent()) return false;
  }

  const safeStartIndex = Number.isInteger(startIndex) && startIndex > 0 && startIndex < queue.length ? startIndex : 0;
  if (safeStartIndex > 0) {
    await TrackPlayer.skip(safeStartIndex);
    if (!isCurrent()) return false;
  }

  if (resumePositionSeconds) {
    await TrackPlayer.seekTo(resumePositionSeconds);
    if (!isCurrent()) return false;
  }

  if (queue.length > 0) {
    await TrackPlayer.play();
    if (!isCurrent()) return false;
  }

  nativeQueueRef.current = queue.length > 0 ? queue.slice() : [];
  return true;
};

export const rebuildNativePlaybackQueue = async (
  queue: PlayableSong[],
  nativeQueueRef: MutableRefObject<Song[]>,
  resumePositionSeconds?: number,
  startIndex = 0,
): Promise<void> => runExclusiveNativeQueueReplacement(async context => {
  const rebuilt = await rebuildNativePlaybackQueueUnlocked(queue, nativeQueueRef, resumePositionSeconds, context, startIndex);
  if (!rebuilt) throw new NativeQueueReplacementStaleError();
});

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
  if (!plan) {
    console.warn('[PlaybackQueue] Unable to build play-song queue plan.', { songId: song.id });
    return;
  }

  const { requestedSong, queueWithRequested, nativeIndex, canReuseNativeQueue } = plan;

  if (canReuseNativeQueue) {
    const orderedQueue = plan.reusableOrderedQueue;

    try {
      await runExclusiveNativePlaybackControl(async () => {
        const activeTrack = await TrackPlayer.getActiveTrack();
        if (activeTrack?.id !== requestedSong.id) {
          await TrackPlayer.skip(nativeIndex);
        }
        await TrackPlayer.play();
      });
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
      return;
    } catch (error) {
      console.warn('[PlaybackQueue] Native skip failed, rebuilding queue.', error);
      // Fall through to a full queue rebuild if native skip is unavailable/fails.
    }
  }

  const orderedQueue = plan.rebuildOrderedQueue;
  const orderedStartIndex = orderedQueue.findIndex(item => normalizeSongId(item.id) === normalizeSongId(requestedSong.id));
  await rebuildNativePlaybackQueue(orderedQueue, nativeQueueRef, undefined, orderedStartIndex);
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


export const runInsertSongQueueAction = async ({
  song,
  currentSongId,
  position,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  setPlaybackQueue,
  setCurrentSong,
  shuffle,
  shuffleRef,
  setShuffle,
}: RunInsertSongQueueActionArgs): Promise<boolean> => {
  if (!isPlayableSong(song)) {
    console.warn('[PlaybackQueue] Unable to insert unplayable song into queue.', { songId: song.id });
    return false;
  }

  const result = await runExclusiveNativeQueueReplacement<InsertQueueActionResult>(async context => {
    const { isCurrent } = context;
    if (!isCurrent()) return 'stale';

    const activeTrack = await TrackPlayer.getActiveTrack();
    if (!isCurrent()) return 'stale';

    const activeSongId = activeTrack?.id ?? currentSongId;
    const activeQueue = queueContextRef.current.length > 0 ? queueContextRef.current.slice() : nativeQueueRef.current.slice();
    const nativeQueue = nativeQueueRef.current.length > 0 ? nativeQueueRef.current.slice() : activeQueue.slice();
    const selectedSong = findSongByNormalizedId(activeQueue, activeSongId) ?? findSongByNormalizedId(nativeQueue, activeSongId);
    const nativeInsertIndex = getNativeInsertIndex({ nativeQueue, activeSongId, position });
    const plan = buildQueueWithInsertedSong({ queue: nativeQueue, song, insertIndex: nativeInsertIndex });
    if (!plan.changed) return 'noop';

    try {
      await TrackPlayer.add(toTrackPlayerTrack(song), plan.insertIndex);
      if (!isCurrent()) return 'stale';
      nativeQueueRef.current = plan.queue.slice();
      applyPlaybackQueueState({
        queueContextRef,
        baseQueueContextRef,
        setPlaybackQueue,
        setCurrentSong,
        orderedQueue: plan.queue,
        baseQueue: plan.queue,
        selectedSong,
      });
      const shuffleEnabled = shuffleRef?.current ?? shuffle;
      if (shuffleEnabled) {
        if (shuffleRef) shuffleRef.current = false;
        setShuffle(false);
      }
      return 'applied';
    } catch (error) {
      console.warn('[PlaybackQueue] Failed to insert song into queue.', error);
      return 'failed';
    }
  }).catch(error => {
    console.warn('[PlaybackQueue] Failed to insert song into queue.', error);
    return 'failed' as const;
  });

  return result === 'applied' || result === 'noop';
};

export const runReorderQueueAction = async ({
  fromIndex,
  toIndex,
  currentSongId,
  shuffle,
  shuffleRef,
  setShuffle,
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  setPlaybackQueue,
  setCurrentSong,
}: RunReorderQueueActionArgs): Promise<boolean> => {
  const result = await runExclusiveNativeQueueReplacement<ReorderQueueActionResult>(async context => {
    const { isCurrent } = context;
    if (!isCurrent()) return 'stale';

    const activeTrack = await TrackPlayer.getActiveTrack();
    if (!isCurrent()) return 'stale';

    const activeSongId = activeTrack?.id ?? currentSongId;
    const currentQueue = getCurrentQueueSnapshot(queueContextRef.current, songsRef.current);
    const plan = buildQueueReorderPlan({ queue: currentQueue, fromIndex, toIndex, currentSongId: activeSongId });
    if (!plan) return 'failed';
    if (!plan.changed) return 'noop';

    const previousShuffle = shuffleRef?.current ?? shuffle;
    const progress = await TrackPlayer.getProgress();
    if (!isCurrent()) return 'stale';

    try {
      const rebuilt = await rebuildNativePlaybackQueueUnlocked(
        toPlayableSongs(plan.queue),
        nativeQueueRef,
        progress.position,
        context,
        plan.currentIndex,
      );
      if (!rebuilt || !isCurrent()) return 'stale';

      applyPlaybackQueueState({
        queueContextRef,
        baseQueueContextRef,
        setPlaybackQueue,
        setCurrentSong,
        orderedQueue: plan.queue,
        baseQueue: plan.queue,
        selectedSong: plan.selectedSong,
      });
      if (previousShuffle) {
        if (shuffleRef) shuffleRef.current = false;
        setShuffle(false);
      }
      return 'applied';
    } catch (error) {
      console.warn('[PlaybackQueue] Reorder failed; keeping previous UI state.', error);
      return 'failed';
    }
  }).catch(error => {
    console.warn('[PlaybackQueue] Failed to reorder queue.', error);
    return 'failed' as const;
  });

  return result === 'applied' || result === 'noop';
};

export const runShuffleQueueAction = async ({
  currentSongId,
  shuffle,
  shuffleRef,
  setShuffle,
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  setPlaybackQueue,
  setCurrentSong,
}: RunShuffleQueueActionArgs): Promise<void> => {
  const result = await runExclusiveNativeQueueReplacement<ShuffleQueueActionResult>(async context => {
    const { isCurrent } = context;
    if (!isCurrent()) return 'stale';

    const current = await TrackPlayer.getActiveTrack();
    if (!isCurrent()) return 'stale';

    const currentQueue = getCurrentQueueSnapshot(queueContextRef.current, songsRef.current);
    const currentBaseQueue = baseQueueContextRef.current.slice();
    const shuffleEnabled = shuffleRef?.current ?? shuffle;
    const activeSongId = current?.id ?? currentSongId;
    const plan = buildShuffleTogglePlan({
      currentQueue,
      baseQueue: currentBaseQueue,
      currentSongId: activeSongId,
      shuffleEnabled,
    });
    if (!plan) {
      console.warn('[PlaybackQueue] Shuffle queue plan is empty; skipping toggle.');
      return 'failed';
    }

    const pos = await TrackPlayer.getProgress();
    if (!isCurrent()) return 'stale';

    const { nextQueue, nextBaseQueue, selectedSong } = plan;
    const selectedIndex = selectedSong ? nextQueue.findIndex(song => normalizeSongId(song.id) === normalizeSongId(selectedSong.id)) : 0;
    const rebuilt = await rebuildNativePlaybackQueueUnlocked(
      nextQueue,
      nativeQueueRef,
      pos.position,
      context,
      selectedIndex,
    );
    if (!rebuilt || !isCurrent()) return 'stale';

    applyPlaybackQueueState({
      queueContextRef,
      baseQueueContextRef,
      setPlaybackQueue,
      setCurrentSong,
      orderedQueue: nextQueue.slice(),
      baseQueue: nextBaseQueue,
      selectedSong,
    });
    if (!isCurrent()) return 'stale';

    const nextShuffle = !shuffleEnabled;
    if (shuffleRef) shuffleRef.current = nextShuffle;
    setShuffle(nextShuffle);
    return 'applied';
  }).catch(error => {
    console.warn('[PlaybackQueue] Failed to rebuild queue during shuffle toggle.', error);
    return 'failed' as const;
  });

  void result;
};
