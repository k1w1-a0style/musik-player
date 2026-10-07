import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { Song } from '../types/Song';
import { assertCurrentSongPersistenceSucceeded } from '../utils/currentSongPersistence';
import { isPlayableSong, type PlayableSong } from '../utils/playableSong';
import {
  buildPlaySongQueuePlan,
  buildShuffleTogglePlan,
} from '../utils/playbackPlan';
import { buildQueueReorderPlan } from '../utils/queueReorder';
import { hasSameOrderedSongIds } from '../utils/playbackQueue';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';
import { getNativePlaybackIntent, recordNativePlaybackIntent, restoreNativePlaybackIntent } from '../utils/nativePlaybackIntent';
import {
  type NativeHydrationCapture,
  NativeMutationHydrationStaleError,
  type NativeQueueReplacementContext,
  runExclusiveNativeQueueReplacement,
} from '../utils/nativeQueueMutationLock';
import {
  commitNativeQueueTruth,
  createNativeQueueMutationSnapshot,
  deriveBaseQueue,
  persistNativeCurrentSong,
  readNativeQueueTruth,
  recoverNativeQueueMutation,
  type NativeQueueMutationSnapshot,
  type NativeQueueReadback,
  type NativePlaybackState,
  type NativeQueueRecoveryResult,
  type NativeQueueReplacementProgress,
} from './nativeQueueRecovery';
const hydrationMutationOptions = (hydrationCapture: NativeHydrationCapture) =>
  hydrationCapture === undefined ? undefined : { hydrationCapture };

export type { NativeQueueMutationSnapshot, NativeQueueRecoveryResult } from './nativeQueueRecovery';

export type NativeQueueActionResult =
  | { status: 'applied' | 'noop' | 'stale' }
  | { status: 'reconciled' | 'rolled-back'; recovery: Exclude<NativeQueueRecoveryResult, { status: 'failed' }> }
  | { status: 'failed'; recovery?: Extract<NativeQueueRecoveryResult, { status: 'failed' }>; error?: unknown };

interface PlaybackQueueActionRefs {
  hydrationCapture?: NativeHydrationCapture;
  playbackIntentRevision?: number;
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
  shuffle?: boolean;
  shuffleRef?: MutableRefObject<boolean>;
  setShuffle?: Dispatch<SetStateAction<boolean>>;
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
const toRecoveryActionResult = (recovery: NativeQueueRecoveryResult): NativeQueueActionResult => recovery.status === 'failed'
  ? { status: 'failed', recovery } : { status: recovery.status, recovery };
const selectQueueBase = (shuffleEnabled: boolean, shuffledBase: Song[], unshuffledBase: Song[]): Song[] =>
  shuffleEnabled ? shuffledBase : unshuffledBase;
const insertedBaseQueue = (args: RunInsertSongQueueActionArgs, previous: Song[], next: Song[]): Song[] =>
  selectQueueBase(args.shuffleRef?.current ?? args.shuffle,
    buildQueueWithInsertedSong({ queue: previous, song: args.song, insertIndex: previous.length }).queue, next);

export const getCurrentQueueSnapshot = (queueContext: Song[], librarySongs: Song[]): Song[] =>
  (queueContext.length > 0 ? queueContext : librarySongs.filter(isPlayableSong)).slice();

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
  const result = await persistNativeCurrentSong(requestedSong, librarySongs);
  assertCurrentSongPersistenceSucceeded(result);
};

const replaceNativeQueueTracks = async (
  queue: PlayableSong[],
  nativeQueueRef: MutableRefObject<Song[]>,
  context: Pick<NativeQueueReplacementContext, 'isCurrent' | 'beginNativeMutation'>,
  onProgress?: (progress: NativeQueueReplacementProgress) => void,
): Promise<boolean> => {
  const { isCurrent, beginNativeMutation } = context;
  beginNativeMutation();
  await TrackPlayer.reset();
  onProgress?.('reset-confirmed');
  if (!isCurrent()) return false;
  nativeQueueRef.current = [];
  if (queue.length > 0) {
    onProgress?.('add-started');
    await TrackPlayer.add(queue.map(toTrackPlayerTrack));
    onProgress?.('queue-replacement-confirmed');
  }
  return isCurrent();
};

const restoreNativePlaybackState = async (
  queueLength: number,
  playbackState: NativePlaybackState,
  isCurrent: () => boolean,
  onProgress?: (progress: NativeQueueReplacementProgress) => void,
  playbackIntentRevision = getNativePlaybackIntent().revision,
): Promise<boolean> => {
  if (queueLength === 0 || playbackState === 'unknown') return true;
  if (!await restoreNativePlaybackIntent(playbackState, playbackIntentRevision, isCurrent)) return false;
  onProgress?.('playback-confirmed');
  return isCurrent();
};

export const rebuildNativePlaybackQueueUnlocked = async (
  queue: PlayableSong[],
  nativeQueueRef: MutableRefObject<Song[]>,
  resumePositionSeconds?: number,
  replacementContext?: Pick<NativeQueueReplacementContext, 'isCurrent' | 'beginNativeMutation'>,
  startIndex = 0,
  onProgress?: (progress: NativeQueueReplacementProgress) => void,
  playbackState: NativePlaybackState = 'playing',
  playbackIntentRevision = getNativePlaybackIntent().revision,
  onReadback?: (readback: NativeQueueReadback) => void,
): Promise<boolean> => {
  const context = replacementContext ?? { isCurrent: () => true, beginNativeMutation: () => undefined };
  const { isCurrent } = context;

  if (!isCurrent()) return false;
  if (!await replaceNativeQueueTracks(queue, nativeQueueRef, context, onProgress)) return false;

  const safeStartIndex = Number.isInteger(startIndex) && startIndex > 0 && startIndex < queue.length ? startIndex : 0;
  if (safeStartIndex > 0) {
    await TrackPlayer.skip(safeStartIndex);
    onProgress?.('active-track-confirmed');
    if (!isCurrent()) return false;
  }

  if (resumePositionSeconds !== undefined && queue.length > 0) {
    await TrackPlayer.seekTo(resumePositionSeconds);
    onProgress?.('progress-confirmed');
    if (!isCurrent()) return false;
  }

  if (!await restoreNativePlaybackState(queue.length, playbackState, isCurrent, onProgress, playbackIntentRevision)) return false;
  const readback = await readNativeQueueTruth(queue);
  if (!isCurrent()) return false;
  nativeQueueRef.current = readback.queue.slice();
  onReadback?.(readback);
  return true;
};

type PlaySongQueuePlan = NonNullable<ReturnType<typeof buildPlaySongQueuePlan>>;

const rebuildForPlayPlan = async (
  plan: PlaySongQueuePlan,
  nativeQueueRef: MutableRefObject<Song[]>,
  context: NativeQueueReplacementContext,
  playbackIntentRevision: number,
): Promise<NativeQueueReadback | undefined> => {
  const orderedQueue = plan.rebuildOrderedQueue;
  const startIndex = orderedQueue.findIndex(
    item => normalizeSongId(item.id) === normalizeSongId(plan.requestedSong.id),
  );
  let readback: NativeQueueReadback | undefined;
  const rebuilt = await rebuildNativePlaybackQueueUnlocked(
    orderedQueue,
    nativeQueueRef,
    0,
    context,
    startIndex,
    undefined,
    'playing',
    playbackIntentRevision,
    value => { readback = value; },
  );
  return rebuilt && context.isCurrent() ? readback : undefined;
};

const executePlaySongPlan = async (
  plan: PlaySongQueuePlan,
  nativeQueueRef: MutableRefObject<Song[]>,
  context: NativeQueueReplacementContext,
  playbackIntentRevision: number,
): Promise<NativeQueueReadback | undefined> => {
  if (!plan.canReuseNativeQueue) return rebuildForPlayPlan(plan, nativeQueueRef, context, playbackIntentRevision);
  try {
    const activeTrack = await TrackPlayer.getActiveTrack();
    if (!context.isCurrent()) return undefined;
    context.beginNativeMutation();
    if (activeTrack?.id !== plan.requestedSong.id) await TrackPlayer.skip(plan.nativeIndex);
    if (!context.isCurrent()) return undefined;
    if (!await restoreNativePlaybackIntent('playing', playbackIntentRevision, context.isCurrent)) return undefined;
    const readback = await readNativeQueueTruth(plan.reusableOrderedQueue);
    return context.isCurrent() ? readback : undefined;
  } catch (error) {
    console.warn('[PlaybackQueue] Native reuse failed, rebuilding queue.', error);
    return context.isCurrent() ? rebuildForPlayPlan(plan, nativeQueueRef, context, playbackIntentRevision) : undefined;
  }
};

const recoverInsertQueueFailure = async (
  args: RunInsertSongQueueActionArgs,
  knownSongs: Song[],
  previousBaseQueue: Song[],
  snapshot: NativeQueueMutationSnapshot,
  error: unknown,
  isCurrent?: () => boolean,
): Promise<NativeQueueActionResult> => {
  const { song, shuffleRef, setShuffle } = args;
  const recovery = await recoverNativeQueueMutation({ originalError: error, snapshot, knownSongs,
    isCurrent,
    librarySongs: args.songsRef.current, targets: args, preferredBaseQueue: previousBaseQueue,
    reconciliationShuffleStrategy: { kind: 'restore-snapshot', enabled: snapshot.shuffleEnabled } });
  if (isCurrent?.() === false) return { status: 'stale' };
  if (recovery.status === 'failed') {
    console.warn('[PlaybackQueue] Insert recovery failed.', recovery);
    return { status: 'failed', recovery };
  }
  const insertedNatively = recovery.queue.some(item => normalizeSongId(item.id) === normalizeSongId(song.id));
  const candidateBaseQueue = insertedNatively
    ? buildQueueWithInsertedSong({ queue: previousBaseQueue, song, insertIndex: previousBaseQueue.length }).queue
    : previousBaseQueue;
  const semanticBaseQueue = snapshot.shuffleEnabled
    ? deriveBaseQueue(recovery.queue, candidateBaseQueue)
    : recovery.queue.slice();
  args.baseQueueContextRef.current = semanticBaseQueue.slice();
  const nativeIsShuffled = snapshot.shuffleEnabled;
  if (shuffleRef) shuffleRef.current = nativeIsShuffled;
  setShuffle(nativeIsShuffled);
  console.warn('[PlaybackQueue] Insert failed; reconciled to native state.', error);
  return { status: recovery.status, recovery: {
    ...recovery, baseQueue: semanticBaseQueue, shuffleEnabled: nativeIsShuffled,
  } };
};

const recoverShuffleQueueFailure = async (
  args: RunShuffleQueueActionArgs,
  previousBaseQueue: Song[],
  snapshot: NativeQueueMutationSnapshot,
  targetQueue: Song[],
  requestedShuffleEnabled: boolean,
  progress: NativeQueueReplacementProgress,
  error: unknown,
  isCurrent?: () => boolean,
): Promise<NativeQueueActionResult> => {
  const knownSongs = [...args.songsRef.current, ...args.queueContextRef.current, ...snapshot.nativeQueue];
  const recovery = await recoverNativeQueueMutation({ originalError: error, snapshot, knownSongs,
    isCurrent,
    librarySongs: args.songsRef.current, targets: args, preferredBaseQueue: previousBaseQueue,
    reconciliationShuffleStrategy: { kind: 'recover-replacement',
      snapshotEnabled: snapshot.shuffleEnabled, requestedEnabled: requestedShuffleEnabled,
      snapshotQueue: snapshot.nativeQueue, targetQueue, progress } });
  if (recovery.status === 'failed') {
    console.warn('[PlaybackQueue] Shuffle recovery failed.', recovery);
    return { status: 'failed', recovery };
  }
  console.warn('[PlaybackQueue] Failed to rebuild queue during shuffle toggle.', error);
  return { status: recovery.status, recovery };
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
  shuffle = false,
  shuffleRef,
  setShuffle,
  hydrationCapture,
  playbackIntentRevision = recordNativePlaybackIntent('playing').revision,
}: RunPlaySongQueueActionArgs): Promise<NativeQueueActionResult> =>
  runExclusiveNativeQueueReplacement<NativeQueueActionResult>(async context => {
    if (!context.isCurrent()) return { status: 'stale' };
    const sourceQueue = queue && queue.length > 0 ? queue : songsRef.current;
    const plan = buildPlaySongQueuePlan(song, sourceQueue, nativeQueueRef.current);
    if (!plan) {
      console.warn('[PlaybackQueue] Unable to build play-song queue plan.', { songId: song.id });
      return { status: 'failed', error: new Error('Unable to build play-song queue plan.') };
    }
    const knownSongs = [...songsRef.current, ...sourceQueue, ...nativeQueueRef.current];
    const targets = { queueContextRef, baseQueueContextRef, nativeQueueRef, setPlaybackQueue,
      setCurrentSong, shuffleRef, setShuffle };
    const snapshot = await createNativeQueueMutationSnapshot({
      knownSongs,
      shuffleEnabled: shuffleRef?.current ?? shuffle,
      targets,
    });
    try {
      const readback = await executePlaySongPlan(plan, nativeQueueRef, context, playbackIntentRevision);
      if (!readback || !context.isCurrent()) return { status: 'stale' };
      await commitNativeQueueTruth({
        readback, preferredBaseQueue: plan.queueWithRequested, librarySongs: songsRef.current, targets,
        shuffleStrategy: { kind: 'restore-snapshot', enabled: snapshot.shuffleEnabled },
      });
      return { status: 'applied' };
    } catch (error) {
      if (!context.isCurrent()) return { status: 'stale' };
      if (error instanceof NativeMutationHydrationStaleError) return { status: 'stale' };
      const recovery = await recoverNativeQueueMutation({ originalError: error, snapshot, knownSongs,
        isCurrent: context.isCurrent,
        librarySongs: songsRef.current, targets,
        reconciliationShuffleStrategy: { kind: 'restore-snapshot', enabled: snapshot.shuffleEnabled } });
      return toRecoveryActionResult(recovery);
    }
  }, hydrationMutationOptions(hydrationCapture)).catch(error => ({ status: 'failed', error }) as NativeQueueActionResult);

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
  hydrationCapture,
}: RunInsertSongQueueActionArgs): Promise<NativeQueueActionResult> => {
  const actionArgs = { song, currentSongId, position, songsRef, queueContextRef, baseQueueContextRef, nativeQueueRef,
    setPlaybackQueue, setCurrentSong, shuffle, shuffleRef, setShuffle };
  if (!isPlayableSong(song)) {
    console.warn('[PlaybackQueue] Unable to insert unplayable song into queue.', { songId: song.id });
    return { status: 'failed', error: new Error('Song is not playable.') };
  }

  return runExclusiveNativeQueueReplacement<NativeQueueActionResult>(async context => {
    const { isCurrent } = context;
    if (!isCurrent()) return { status: 'stale' };

    const activeTrack = await TrackPlayer.getActiveTrack();
    if (!isCurrent()) return { status: 'stale' };

    const activeSongId = activeTrack?.id ?? currentSongId;
    const activeQueue = queueContextRef.current.length > 0 ? queueContextRef.current.slice() : nativeQueueRef.current.slice();
    const nativeQueue = nativeQueueRef.current.length > 0 ? nativeQueueRef.current.slice() : activeQueue.slice();
    const nativeInsertIndex = getNativeInsertIndex({ nativeQueue, activeSongId, position });
    const plan = buildQueueWithInsertedSong({ queue: nativeQueue, song, insertIndex: nativeInsertIndex });
    if (!plan.changed) return { status: 'noop' };
    const previousBaseQueue = baseQueueContextRef.current.slice();
    const snapshot = await createNativeQueueMutationSnapshot({
      knownSongs: [...songsRef.current, ...activeQueue, ...nativeQueue, song],
      shuffleEnabled: shuffleRef?.current ?? shuffle,
      targets: actionArgs,
    });

    if (!isCurrent()) return { status: 'stale' };
    try {
      context.beginNativeMutation();
      await TrackPlayer.add(toTrackPlayerTrack(song), plan.insertIndex);
      if (!isCurrent()) return { status: 'stale' };
      const readback = await readNativeQueueTruth([...songsRef.current, ...plan.queue]);
      if (!isCurrent()) return { status: 'stale' };
      await commitNativeQueueTruth({
        readback,
        preferredBaseQueue: insertedBaseQueue(actionArgs, previousBaseQueue, plan.queue),
        librarySongs: songsRef.current,
        targets: actionArgs,
        shuffleStrategy: { kind: 'restore-snapshot', enabled: snapshot.shuffleEnabled },
      });
      return { status: 'applied' };
    } catch (error) {
      if (!isCurrent()) return { status: 'stale' };
      if (error instanceof NativeMutationHydrationStaleError) return { status: 'stale' };
      return recoverInsertQueueFailure(actionArgs, [...activeQueue, ...nativeQueue, song], previousBaseQueue, snapshot, error, isCurrent);
    }
  }, hydrationMutationOptions(hydrationCapture)).catch(error => {
    console.warn('[PlaybackQueue] Failed to insert song into queue.', error);
    return { status: 'failed', error } as NativeQueueActionResult;
  });
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
  hydrationCapture,
}: RunReorderQueueActionArgs): Promise<NativeQueueActionResult> =>
  runExclusiveNativeQueueReplacement<NativeQueueActionResult>(async context => {
    const { isCurrent } = context;
    if (!isCurrent()) return { status: 'stale' };

    const activeTrack = await TrackPlayer.getActiveTrack();
    if (!isCurrent()) return { status: 'stale' };

    const activeSongId = activeTrack?.id ?? currentSongId;
    const currentQueue = getCurrentQueueSnapshot(queueContextRef.current, songsRef.current);
    const plan = buildQueueReorderPlan({ queue: currentQueue, fromIndex, toIndex, currentSongId: activeSongId });
    if (!plan) return { status: 'failed', error: new Error('Unable to build reorder plan.') };
    if (!plan.changed) return { status: 'noop' };

    const previousShuffle = shuffleRef?.current ?? shuffle;
    const targets = { queueContextRef, baseQueueContextRef, nativeQueueRef, setPlaybackQueue,
      setCurrentSong, shuffleRef, setShuffle };
    const snapshot = await createNativeQueueMutationSnapshot({
      knownSongs: [...songsRef.current, ...currentQueue, ...nativeQueueRef.current],
      shuffleEnabled: previousShuffle,
      targets,
    });

    try {
      if (!hasSameOrderedSongIds(snapshot.nativeQueue, currentQueue)) {
        throw new Error('Native queue changed before reorder could be applied.');
      }
      context.beginNativeMutation();
      await TrackPlayer.move(plan.fromIndex, plan.toIndex);
      if (!isCurrent()) return { status: 'stale' };
      const readback = await readNativeQueueTruth([...songsRef.current, ...plan.queue]);
      if (!isCurrent()) return { status: 'stale' };
      if (!hasSameOrderedSongIds(readback.queue, plan.queue)) {
        throw new Error('Native queue did not confirm the requested reorder.');
      }
      await commitNativeQueueTruth({
        readback,
        preferredBaseQueue: selectQueueBase(previousShuffle, snapshot.baseQueue, plan.queue),
        librarySongs: songsRef.current,
        targets,
        shuffleStrategy: { kind: 'confirmed-action', enabled: previousShuffle },
      });
      return { status: 'applied' };
    } catch (error) {
      if (!isCurrent()) return { status: 'stale' };
      if (error instanceof NativeMutationHydrationStaleError) return { status: 'stale' };
      const recovery = await recoverNativeQueueMutation({ originalError: error, snapshot,
        isCurrent,
        knownSongs: [...songsRef.current, ...plan.queue, ...snapshot.nativeQueue],
        librarySongs: songsRef.current, targets, preferredBaseQueue: snapshot.baseQueue,
        reconciliationShuffleStrategy: { kind: 'restore-snapshot', enabled: snapshot.shuffleEnabled } });
      if (recovery.status === 'failed') console.warn('[PlaybackQueue] Reorder recovery failed.', recovery);
      console.warn('[PlaybackQueue] Reorder failed; reconciled to native state.', error);
      return toRecoveryActionResult(recovery);
    }
  }, hydrationMutationOptions(hydrationCapture)).catch(error => {
    console.warn('[PlaybackQueue] Failed to reorder queue.', error);
    return { status: 'failed', error } as NativeQueueActionResult;
  });

const prepareShuffleQueueMutation = async (args: RunShuffleQueueActionArgs, isCurrent: () => boolean) => {
  const current = await TrackPlayer.getActiveTrack();
  if (!isCurrent()) return null;
  const currentQueue = getCurrentQueueSnapshot(args.queueContextRef.current, args.songsRef.current);
  const shuffleEnabled = args.shuffleRef?.current ?? args.shuffle;
  const plan = buildShuffleTogglePlan({ currentQueue, baseQueue: args.baseQueueContextRef.current.slice(),
    currentSongId: current?.id ?? args.currentSongId, shuffleEnabled });
  if (!plan) throw new Error('Shuffle plan is empty.');
  const pos = await TrackPlayer.getProgress();
  if (!isCurrent()) return null;
  const snapshot = await createNativeQueueMutationSnapshot({
    knownSongs: [...args.songsRef.current, ...currentQueue, ...args.nativeQueueRef.current],
    shuffleEnabled, targets: args,
  });
  snapshot.playbackIntentRevision = args.playbackIntentRevision;
  return { plan, pos, snapshot, shuffleEnabled };
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
  hydrationCapture,
  playbackIntentRevision = getNativePlaybackIntent().revision,
}: RunShuffleQueueActionArgs): Promise<NativeQueueActionResult> => {
  const actionArgs = { currentSongId, shuffle, shuffleRef, setShuffle, songsRef, queueContextRef,
    baseQueueContextRef, nativeQueueRef, setPlaybackQueue, setCurrentSong, playbackIntentRevision };
  return runExclusiveNativeQueueReplacement<NativeQueueActionResult>(async context => {
    const { isCurrent } = context;
    if (!isCurrent()) return { status: 'stale' };
    const previousBaseQueue = baseQueueContextRef.current.slice();
    let mutationSnapshot: NativeQueueMutationSnapshot | undefined;
    let progress: NativeQueueReplacementProgress = 'not-started';
    let targetQueue: Song[] = [];
    let requestedShuffleEnabled = !shuffle;
    try {
    const prepared = await prepareShuffleQueueMutation(actionArgs, isCurrent);
    if (!prepared) return { status: 'stale' };
    const { plan, pos, snapshot, shuffleEnabled } = prepared;
    const { nextQueue, nextBaseQueue, selectedSong } = plan;
    targetQueue = nextQueue;
    requestedShuffleEnabled = !shuffleEnabled;
    mutationSnapshot = snapshot;
    const selectedIndex = selectedSong
      ? nextQueue.findIndex(song => normalizeSongId(song.id) === normalizeSongId(selectedSong.id)) : 0;
    let readback: NativeQueueReadback | undefined;
    const rebuilt = await rebuildNativePlaybackQueueUnlocked(
      nextQueue,
      nativeQueueRef,
      pos.position,
      context,
      selectedIndex,
      nextProgress => { progress = nextProgress; },
      mutationSnapshot.playbackState,
      mutationSnapshot.playbackIntentRevision,
      value => { readback = value; },
    );
    if (!rebuilt || !readback || !isCurrent()) return { status: 'stale' };
    await commitNativeQueueTruth({
      readback, preferredBaseQueue: nextBaseQueue, librarySongs: songsRef.current, targets: actionArgs,
      shuffleStrategy: { kind: 'confirmed-action', enabled: !shuffleEnabled },
    });
    if (!isCurrent()) return { status: 'stale' };
    return { status: 'applied' };
    } catch (error) {
      if (!isCurrent()) return { status: 'stale' };
      if (error instanceof NativeMutationHydrationStaleError) return { status: 'stale' };
      if (!mutationSnapshot) throw error;
      return recoverShuffleQueueFailure(actionArgs, previousBaseQueue, mutationSnapshot, targetQueue,
        requestedShuffleEnabled, progress, error, isCurrent);
    }
  }, hydrationMutationOptions(hydrationCapture)).catch(error => {
    console.warn('[PlaybackQueue] Shuffle recovery failed.', error);
    return { status: 'failed', error } as NativeQueueActionResult;
  });
};
