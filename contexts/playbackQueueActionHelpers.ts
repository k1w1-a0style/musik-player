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
  runExclusiveNativeQueueReplacement,
} from '../utils/nativeQueueMutationLock';
import {
  commitNativeQueueTruth,
  createNativeQueueMutationSnapshot,
  deriveRecoveredShuffleState,
  readNativeQueueTruth,
  recoverNativeQueueMutation,
  type NativeQueueMutationSnapshot,
  type NativeQueueRecoveryResult,
} from './nativeQueueRecovery';

export type { NativeQueueMutationSnapshot, NativeQueueRecoveryResult } from './nativeQueueRecovery';

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

interface ReconcileNativeQueueArgs extends Pick<PlaybackQueueActionRefs,
  'queueContextRef' | 'baseQueueContextRef' | 'nativeQueueRef' | 'setPlaybackQueue' | 'setCurrentSong'> {
  knownSongs: Song[];
  baseQueue?: Song[];
}

const deriveShuffleState = (queue: Song[], baseQueue: Song[]): boolean =>
  deriveRecoveredShuffleState(queue, baseQueue);

export const reconcilePlaybackQueueFromNative = async ({
  knownSongs,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  setPlaybackQueue,
  setCurrentSong,
  baseQueue,
}: ReconcileNativeQueueArgs): Promise<Extract<NativeQueueRecoveryResult, { status: 'reconciled' }>> => {
  const candidates = [...knownSongs, ...nativeQueueRef.current, ...queueContextRef.current];
  const readback = await readNativeQueueTruth(candidates);
  const committed = await commitNativeQueueTruth({
    readback,
    preferredBaseQueue: baseQueue ?? readback.queue,
    librarySongs: knownSongs,
    targets: { queueContextRef, baseQueueContextRef, nativeQueueRef, setPlaybackQueue, setCurrentSong },
  });
  return { status: 'reconciled', ...committed };
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
    const removed = await (storage.remove(StorageKeys.CURRENT_SONG_ID) as Promise<unknown>);
    if (removed === false) throw new Error('Current-song removal was not confirmed.');
    return;
  }

  const isLibrarySong = librarySongs.some(item => normalizeSongId(item.id) === requestedSongId);
  if (isLibrarySong) {
    const stored = await storage.set(StorageKeys.CURRENT_SONG_ID, requestedSongId);
    if (!stored) throw new Error('Current-song persistence was not confirmed.');
    return;
  }
  const removed = await (storage.remove(StorageKeys.CURRENT_SONG_ID) as Promise<unknown>);
  if (removed === false) throw new Error('Current-song removal was not confirmed.');
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
    // Publish native truth immediately after the non-cancellable bridge call.
    nativeQueueRef.current = queue.slice();
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

type PlaySongQueuePlan = NonNullable<ReturnType<typeof buildPlaySongQueuePlan>>;

const rebuildForPlayPlan = async (
  plan: PlaySongQueuePlan,
  nativeQueueRef: MutableRefObject<Song[]>,
  context: NativeQueueReplacementContext,
): Promise<Song[] | undefined> => {
  const orderedQueue = plan.rebuildOrderedQueue;
  const startIndex = orderedQueue.findIndex(
    item => normalizeSongId(item.id) === normalizeSongId(plan.requestedSong.id),
  );
  const rebuilt = await rebuildNativePlaybackQueueUnlocked(
    orderedQueue,
    nativeQueueRef,
    undefined,
    context,
    startIndex,
  );
  return rebuilt && context.isCurrent() ? orderedQueue : undefined;
};

const executePlaySongPlan = async (
  plan: PlaySongQueuePlan,
  nativeQueueRef: MutableRefObject<Song[]>,
  context: NativeQueueReplacementContext,
): Promise<Song[] | undefined> => {
  if (!plan.canReuseNativeQueue) return rebuildForPlayPlan(plan, nativeQueueRef, context);
  try {
    const activeTrack = await TrackPlayer.getActiveTrack();
    if (!context.isCurrent()) return undefined;
    if (activeTrack?.id !== plan.requestedSong.id) await TrackPlayer.skip(plan.nativeIndex);
    await TrackPlayer.play();
    return context.isCurrent() ? plan.reusableOrderedQueue : undefined;
  } catch (error) {
    console.warn('[PlaybackQueue] Native reuse failed, rebuilding queue.', error);
    return context.isCurrent() ? rebuildForPlayPlan(plan, nativeQueueRef, context) : undefined;
  }
};

const persistCurrentSongAfterPlayback = async (song: Song, librarySongs: Song[]): Promise<void> => {
  try {
    await persistRequestedSongId(song, librarySongs);
  } catch (error) {
    console.warn('[PlaybackQueue] Failed to persist current song after successful playback.', error);
  }
};

const recoverInsertQueueFailure = async (
  args: RunInsertSongQueueActionArgs,
  knownSongs: Song[],
  previousBaseQueue: Song[],
  snapshot: NativeQueueMutationSnapshot,
  error: unknown,
): Promise<'failed'> => {
  const { song, shuffle, shuffleRef, setShuffle } = args;
  const recovery = await recoverNativeQueueMutation({ originalError: error, snapshot, knownSongs,
    librarySongs: args.songsRef.current, targets: args, preferredBaseQueue: previousBaseQueue });
  if (recovery.status === 'failed') {
    console.warn('[PlaybackQueue] Insert recovery failed.', recovery);
    return 'failed';
  }
  const insertedNatively = recovery.queue.some(item => normalizeSongId(item.id) === normalizeSongId(song.id));
  const previousBaseStillKnown = previousBaseQueue.filter(baseSong =>
    recovery.queue.some(item => normalizeSongId(item.id) === normalizeSongId(baseSong.id)));
  const semanticBaseQueue = (shuffleRef?.current ?? shuffle)
    ? (insertedNatively
      ? buildQueueWithInsertedSong({ queue: previousBaseStillKnown, song, insertIndex: previousBaseStillKnown.length }).queue
      : previousBaseStillKnown)
    : recovery.queue;
  args.baseQueueContextRef.current = semanticBaseQueue.slice();
  const nativeIsShuffled = deriveShuffleState(recovery.queue, semanticBaseQueue);
  if (shuffleRef) shuffleRef.current = nativeIsShuffled;
  setShuffle(nativeIsShuffled);
  console.warn('[PlaybackQueue] Insert failed; reconciled to native state.', error);
  return 'failed';
};

const recoverShuffleQueueFailure = async (
  args: RunShuffleQueueActionArgs,
  previousBaseQueue: Song[],
  snapshot: NativeQueueMutationSnapshot,
  error: unknown,
): Promise<'failed'> => {
  const knownSongs = [...args.songsRef.current, ...args.queueContextRef.current, ...snapshot.nativeQueue];
  const recovery = await recoverNativeQueueMutation({ originalError: error, snapshot, knownSongs,
    librarySongs: args.songsRef.current, targets: args, preferredBaseQueue: previousBaseQueue });
  if (recovery.status === 'failed') {
    console.warn('[PlaybackQueue] Shuffle recovery failed.', recovery);
    return 'failed';
  }
  const nativeIsShuffled = deriveShuffleState(recovery.queue, previousBaseQueue);
  if (args.shuffleRef) args.shuffleRef.current = nativeIsShuffled;
  args.setShuffle(nativeIsShuffled);
  console.warn('[PlaybackQueue] Failed to rebuild queue during shuffle toggle.', error);
  return 'failed';
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
  await runExclusiveNativeQueueReplacement(async context => {
    if (!context.isCurrent()) return;
    const sourceQueue = queue && queue.length > 0 ? queue : songsRef.current;
    const plan = buildPlaySongQueuePlan(song, sourceQueue, nativeQueueRef.current);
    if (!plan) {
      console.warn('[PlaybackQueue] Unable to build play-song queue plan.', { songId: song.id });
      return;
    }
    const knownSongs = [...songsRef.current, ...sourceQueue, ...nativeQueueRef.current];
    const targets = { queueContextRef, baseQueueContextRef, nativeQueueRef, setPlaybackQueue, setCurrentSong };
    const snapshot = await createNativeQueueMutationSnapshot({
      knownSongs,
      currentSong: findSongByNormalizedId(queueContextRef.current, plan.requestedSong.id) ?? null,
      shuffleEnabled: false,
      targets,
    });
    let orderedQueue: Song[] | undefined;
    try {
      orderedQueue = await executePlaySongPlan(plan, nativeQueueRef, context);
    } catch (error) {
      await recoverNativeQueueMutation({ originalError: error, snapshot, knownSongs,
        librarySongs: songsRef.current, targets });
      throw error;
    }
    if (!orderedQueue) return;
    applyPlaybackQueueState({
      queueContextRef,
      baseQueueContextRef,
      setPlaybackQueue,
      setCurrentSong,
      orderedQueue,
      baseQueue: plan.queueWithRequested,
      selectedSong: plan.requestedSong,
    });
    await persistCurrentSongAfterPlayback(plan.requestedSong, songsRef.current);
  });
};

export const runInsertSongQueueAction = async ({
  song,
  currentSongId,
  position,
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  setPlaybackQueue,
  setCurrentSong,
  shuffle,
  shuffleRef,
  setShuffle,
}: RunInsertSongQueueActionArgs): Promise<boolean> => {
  const actionArgs = { song, currentSongId, position, songsRef, queueContextRef, baseQueueContextRef, nativeQueueRef,
    setPlaybackQueue, setCurrentSong, shuffle, shuffleRef, setShuffle };
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
    const previousBaseQueue = baseQueueContextRef.current.slice();
    const snapshot = await createNativeQueueMutationSnapshot({
      knownSongs: [...songsRef.current, ...activeQueue, ...nativeQueue, song],
      currentSong: selectedSong ?? null,
      shuffleEnabled: shuffleRef?.current ?? shuffle,
      targets: actionArgs,
    });

    try {
      await TrackPlayer.add(toTrackPlayerTrack(song), plan.insertIndex);
      nativeQueueRef.current = plan.queue.slice();
      if (!isCurrent()) return 'stale';
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
      return recoverInsertQueueFailure(actionArgs, [...activeQueue, ...nativeQueue, song], previousBaseQueue, snapshot, error);
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
    const targets = { queueContextRef, baseQueueContextRef, nativeQueueRef, setPlaybackQueue,
      setCurrentSong, shuffleRef, setShuffle };
    const snapshot = await createNativeQueueMutationSnapshot({
      knownSongs: [...songsRef.current, ...currentQueue, ...nativeQueueRef.current],
      currentSong: findSongByNormalizedId(currentQueue, activeSongId) ?? null,
      shuffleEnabled: previousShuffle,
      targets,
    });

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
      const recovery = await recoverNativeQueueMutation({ originalError: error, snapshot,
        knownSongs: [...songsRef.current, ...plan.queue, ...snapshot.nativeQueue],
        librarySongs: songsRef.current, targets, preferredBaseQueue: snapshot.baseQueue });
      if (recovery.status === 'failed') console.warn('[PlaybackQueue] Reorder recovery failed.', recovery);
      console.warn('[PlaybackQueue] Reorder failed; reconciled to native state.', error);
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
  const actionArgs = { currentSongId, shuffle, shuffleRef, setShuffle, songsRef, queueContextRef,
    baseQueueContextRef, nativeQueueRef, setPlaybackQueue, setCurrentSong };
  const result = await runExclusiveNativeQueueReplacement<ShuffleQueueActionResult>(async context => {
    const { isCurrent } = context;
    if (!isCurrent()) return 'stale';
    const previousBaseQueue = baseQueueContextRef.current.slice();
    let mutationSnapshot: NativeQueueMutationSnapshot | undefined;
    try {
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
    mutationSnapshot = await createNativeQueueMutationSnapshot({
      knownSongs: [...songsRef.current, ...currentQueue, ...nativeQueueRef.current],
      currentSong: selectedSong ?? null,
      shuffleEnabled,
      targets: actionArgs,
    });
    const selectedIndex = selectedSong
      ? nextQueue.findIndex(song => normalizeSongId(song.id) === normalizeSongId(selectedSong.id)) : 0;
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
    } catch (error) {
      if (!mutationSnapshot) throw error;
      return recoverShuffleQueueFailure(actionArgs, previousBaseQueue, mutationSnapshot, error);
    }
  }).catch(error => {
    console.warn('[PlaybackQueue] Shuffle recovery failed.', error);
    return 'failed' as const;
  });

  void result;
};
