import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import TrackPlayer, { State, type Track } from 'react-native-track-player';
import type { Song } from '../types/Song';
import { StorageKeys, storage } from '../utils/storage';
import { isPlayableSong } from '../utils/playableSong';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';

export type NativePlaybackState = 'playing' | 'paused' | 'stopped' | 'unknown';

export interface NativeQueueReadback {
  queue: Song[];
  activeSong: Song | null;
  activeTrackId: string | null;
  activeIndex: number;
  progressSeconds: number;
  playbackState: NativePlaybackState;
}

export interface NativeQueueMutationSnapshot extends NativeQueueReadback {
  nativeQueue: Song[];
  baseQueue: Song[];
  shuffleEnabled: boolean;
}

export interface NativeQueueRecoveryDiagnostics {
  originalError: unknown;
  initialReadbackError?: unknown;
  rollbackExecutionError?: unknown;
  rollbackVerificationError?: unknown;
  finalReadbackError?: unknown;
}

export type NativeQueueRecoveryFailureClassification = 'readback-unstable' | 'fatal';

const RECOVERY_READBACK_ERROR_KEYS = [
  'originalError',
  'initialReadbackError',
  'rollbackVerificationError',
  'finalReadbackError',
] as const satisfies readonly (keyof NativeQueueRecoveryDiagnostics)[];

/**
 * Classifies only a completely failed recovery. Instability is fail-open only
 * when rollback execution itself succeeded and every recorded error from the
 * mutation/readback/verification stages is the bounded unstable-readback type.
 */
export const classifyNativeQueueRecoveryFailure = (
  diagnostics: NativeQueueRecoveryDiagnostics,
): NativeQueueRecoveryFailureClassification => {
  if (diagnostics.rollbackExecutionError !== undefined) return 'fatal';
  const errors = RECOVERY_READBACK_ERROR_KEYS
    .map(key => diagnostics[key])
    .filter((error): error is unknown => error !== undefined);
  return errors.length > 0 && errors.every(error => error instanceof NativeQueueReadbackUnstableError)
    ? 'readback-unstable'
    : 'fatal';
};

export type NativeQueueReplacementProgress =
  | 'not-started' | 'reset-confirmed' | 'add-started' | 'queue-replacement-confirmed'
  | 'active-track-confirmed' | 'progress-confirmed' | 'playback-confirmed';

export type NativeQueueShuffleStrategy =
  | { kind: 'confirmed-action'; enabled: boolean }
  | { kind: 'restore-snapshot'; enabled: boolean }
  | { kind: 'derive-from-order' }
  | { kind: 'recover-replacement'; snapshotEnabled: boolean; requestedEnabled: boolean;
      snapshotQueue: Song[]; targetQueue: Song[]; progress: NativeQueueReplacementProgress };

export type CurrentSongPersistenceStatus =
  | 'set-confirmed'
  | 'remove-confirmed'
  | 'not-required'
  | 'unconfirmed'
  | 'rejected';

export interface CurrentSongPersistenceResult {
  status: CurrentSongPersistenceStatus;
  error?: unknown;
}

interface RecoveredState {
  queue: Song[];
  baseQueue: Song[];
  activeSong: Song | null;
  shuffleEnabled: boolean;
  readback: NativeQueueReadback;
  currentSongPersistence: CurrentSongPersistenceResult;
  persistenceError?: unknown;
}

export type NativeQueueRecoveryResult =
  | ({ status: 'reconciled'; diagnostics: NativeQueueRecoveryDiagnostics } & RecoveredState)
  | ({ status: 'rolled-back'; diagnostics: NativeQueueRecoveryDiagnostics } & RecoveredState)
  | ({ status: 'failed'; persistenceError?: unknown; diagnostics: NativeQueueRecoveryDiagnostics });

export interface NativeQueueStateTargets {
  nativeQueueRef: MutableRefObject<Song[]>;
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  setPlaybackQueue: Dispatch<SetStateAction<Song[]>>;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  shuffleRef?: MutableRefObject<boolean>;
  setShuffle?: Dispatch<SetStateAction<boolean>>;
}

const normalizedId = (value: unknown): string | undefined => {
  const id = String(value ?? '').trim();
  return id || undefined;
};

const findKnownSong = (songs: Song[], id: unknown): Song | undefined => {
  const wanted = normalizedId(id);
  return wanted ? songs.find(song => normalizedId(song.id) === wanted) : undefined;
};

export const mapNativeTracksToSongs = (tracks: Track[], knownSongs: Song[]): Song[] => tracks.map(track => {
  const song = findKnownSong(knownSongs, track.id);
  if (!song) throw new Error(`Native queue readback contained unknown track "${String(track.id)}".`);
  return song;
});

const toNativePlaybackState = (state: State): NativePlaybackState => {
  if (state === State.Playing) return 'playing';
  if (state === State.Paused) return 'paused';
  if (state === State.Stopped || state === State.None || state === State.Ended) return 'stopped';
  return 'unknown';
};

export interface NativeQueueReadbackObservation {
  queueLength: number;
  finalQueueLength: number;
  firstTrackId: string | null;
  secondTrackId: string | null;
  firstIndex: number;
  secondIndex: number;
}

export class NativeQueueReadbackUnstableError extends Error {
  readonly attempts: number;
  readonly observations: NativeQueueReadbackObservation[];

  constructor(observations: NativeQueueReadbackObservation[]) {
    super(`Native queue readback remained unstable after ${observations.length} attempts.`);
    this.name = 'NativeQueueReadbackUnstableError';
    this.attempts = observations.length;
    this.observations = observations;
  }
}

const MAX_NATIVE_QUEUE_READBACK_ATTEMPTS = 3;
const trackIdsMatch = (left: Track[], right: Track[]): boolean => left.length === right.length
  && left.every((track, index) => normalizedId(track.id) === normalizedId(right[index]?.id));
const sampleIndex = (value: number | undefined): number => value ?? -1;

const resolveActiveIndex = (queue: Song[], activeTrackId: string | null, sampledIndex: number): number => {
  if (activeTrackId === null) return -1;
  if (sampledIndex >= 0) return sampledIndex;
  const matches = queue.reduce<number[]>((indices, song, index) => {
    if (normalizedId(song.id) === activeTrackId) indices.push(index);
    return indices;
  }, []);
  if (matches.length !== 1) throw new Error(`Active native track "${activeTrackId}" has no unique queue index.`);
  return matches[0];
};

const readStableNativeQueueAttempt = async (knownSongs: Song[]) => {
  const firstTracks = await TrackPlayer.getQueue();
  const firstTrack = await TrackPlayer.getActiveTrack();
  const firstIndex = sampleIndex(await TrackPlayer.getActiveTrackIndex());
  const progress = await TrackPlayer.getProgress();
  const playback = await TrackPlayer.getPlaybackState();
  const secondTrack = await TrackPlayer.getActiveTrack();
  const secondIndex = sampleIndex(await TrackPlayer.getActiveTrackIndex());
  const secondTracks = await TrackPlayer.getQueue();
  const firstTrackId = normalizedId(firstTrack?.id) ?? null;
  const secondTrackId = normalizedId(secondTrack?.id) ?? null;
  const observation: NativeQueueReadbackObservation = {
    queueLength: firstTracks.length, finalQueueLength: secondTracks.length,
    firstTrackId, secondTrackId, firstIndex, secondIndex,
  };
  if (firstTrackId !== secondTrackId || firstIndex !== secondIndex || !trackIdsMatch(firstTracks, secondTracks)) {
    return { observation } as const;
  }
  if (secondTrackId === null && secondIndex >= 0) return { observation } as const;
  const queue = mapNativeTracksToSongs(secondTracks, knownSongs);
  const activeIndex = resolveActiveIndex(queue, secondTrackId, secondIndex);
  const activeSong = activeIndex >= 0 ? queue[activeIndex] ?? null : null;
  if (secondTrackId !== null && (activeSong === null || normalizedId(activeSong.id) !== secondTrackId)) {
    throw new Error(`Active native track "${secondTrackId}" does not match its queue index.`);
  }
  return { observation, readback: {
    queue, activeSong, activeTrackId: secondTrackId, activeIndex,
    progressSeconds: progress.position, playbackState: toNativePlaybackState(playback.state),
  } satisfies NativeQueueReadback } as const;
};

export const readNativeQueueTruth = async (knownSongs: Song[]): Promise<NativeQueueReadback> => {
  const observations: NativeQueueReadbackObservation[] = [];
  for (let attempt = 0; attempt < MAX_NATIVE_QUEUE_READBACK_ATTEMPTS; attempt += 1) {
    const sample = await readStableNativeQueueAttempt(knownSongs);
    observations.push(sample.observation);
    if (sample.readback) return sample.readback;
  }
  throw new NativeQueueReadbackUnstableError(observations);
};


export const createNativeQueueMutationSnapshot = async ({
  knownSongs,
  shuffleEnabled,
  targets,
}: {
  knownSongs: Song[];
  shuffleEnabled: boolean;
  targets: NativeQueueStateTargets;
}): Promise<NativeQueueMutationSnapshot> => {
  const readback = await readNativeQueueTruth([...knownSongs, ...targets.nativeQueueRef.current]);
  return {
    ...readback,
    nativeQueue: readback.queue.slice(),
    baseQueue: targets.baseQueueContextRef.current.slice(),
    shuffleEnabled,
  };
};

const idCounts = (songs: Song[]): Map<string, number> | null => {
  const counts = new Map<string, number>();
  for (const song of songs) {
    const id = normalizedId(song.id);
    if (!id) return null;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
};

export const hasSameNormalizedIdMultiset = (left: Song[], right: Song[]): boolean => {
  if (left.length !== right.length) return false;
  const leftCounts = idCounts(left);
  const rightCounts = idCounts(right);
  if (!leftCounts || !rightCounts || leftCounts.size !== rightCounts.size) return false;
  return [...leftCounts].every(([id, count]) => rightCounts.get(id) === count);
};

export const hasSameNormalizedQueueOrder = (left: Song[], right: Song[]): boolean => left.length === right.length
  && left.every((song, index) => normalizedId(song.id) === normalizedId(right[index]?.id));

export const deriveBaseQueue = (queue: Song[], preferredBaseQueue: Song[]): Song[] =>
  hasSameNormalizedIdMultiset(queue, preferredBaseQueue) ? preferredBaseQueue.slice() : queue.slice();

export const deriveRecoveredShuffleState = (queue: Song[], baseQueue: Song[]): boolean =>
  hasSameNormalizedIdMultiset(queue, baseQueue) && !hasSameNormalizedQueueOrder(queue, baseQueue);

const resolveReplacementShuffleState = (
  strategy: Extract<NativeQueueShuffleStrategy, { kind: 'recover-replacement' }>,
  queue: Song[],
): boolean => {
  const replacementStarted = strategy.progress !== 'not-started' && strategy.progress !== 'reset-confirmed';
  if (replacementStarted && hasSameNormalizedQueueOrder(queue, strategy.targetQueue)) return strategy.requestedEnabled;
  return strategy.snapshotEnabled;
};

export const resolveShuffleState = (
  strategy: NativeQueueShuffleStrategy,
  queue: Song[],
  baseQueue: Song[],
): boolean => strategy.kind === 'derive-from-order'
  ? deriveRecoveredShuffleState(queue, baseQueue)
  : strategy.kind === 'recover-replacement'
    ? resolveReplacementShuffleState(strategy, queue)
    : strategy.enabled;

export const persistNativeCurrentSong = async (
  activeSong: Song | null,
  librarySongs: Song[],
  previousId?: string | null,
): Promise<CurrentSongPersistenceResult> => {
  const activeId = normalizedId(activeSong?.id) ?? null;
  const librarySong = activeId ? findKnownSong(librarySongs, activeId) : undefined;
  const desiredId = librarySong ? activeId : null;
  if (previousId !== undefined && normalizedId(previousId) === (desiredId ?? undefined)) {
    return { status: 'not-required' };
  }
  try {
    const confirmed = desiredId
      ? await storage.set(StorageKeys.CURRENT_SONG_ID, desiredId)
      : await (storage.remove(StorageKeys.CURRENT_SONG_ID) as Promise<unknown>);
    if (confirmed === false) return { status: 'unconfirmed', error: new Error('Current-song persistence was not confirmed.') };
    return { status: desiredId ? 'set-confirmed' : 'remove-confirmed' };
  } catch (error) {
    return { status: 'rejected', error };
  }
};

export const commitNativeQueueTruth = async ({
  readback,
  preferredBaseQueue,
  librarySongs,
  targets,
  previousPersistedId,
  shuffleStrategy,
  persistCurrentSong = true,
}: {
  readback: NativeQueueReadback;
  preferredBaseQueue: Song[];
  librarySongs: Song[];
  targets: NativeQueueStateTargets;
  previousPersistedId?: string | null;
  shuffleStrategy: NativeQueueShuffleStrategy;
  persistCurrentSong?: boolean;
}): Promise<RecoveredState> => {
  const queue = readback.queue.slice();
  const baseQueue = deriveBaseQueue(queue, preferredBaseQueue);
  const shuffleEnabled = resolveShuffleState(shuffleStrategy, queue, baseQueue);
  targets.nativeQueueRef.current = queue.slice();
  targets.queueContextRef.current = queue.slice();
  targets.baseQueueContextRef.current = baseQueue.slice();
  targets.setPlaybackQueue(queue.slice());
  targets.setCurrentSong(readback.activeSong);
  if (targets.shuffleRef) targets.shuffleRef.current = shuffleEnabled;
  targets.setShuffle?.(shuffleEnabled);
  const currentSongPersistence = persistCurrentSong
    ? await persistNativeCurrentSong(readback.activeSong, librarySongs, previousPersistedId)
    : { status: 'not-required' as const };
  return {
    queue,
    baseQueue,
    activeSong: readback.activeSong,
    shuffleEnabled,
    readback,
    currentSongPersistence,
    persistenceError: currentSongPersistence.error,
  };
};

export const executeNativeQueueRollback = async (snapshot: NativeQueueMutationSnapshot): Promise<void> => {
  await TrackPlayer.reset();
  if (snapshot.nativeQueue.length === 0) return;
  const playableQueue = snapshot.nativeQueue.filter(isPlayableSong);
  if (playableQueue.length !== snapshot.nativeQueue.length) throw new Error('Snapshot queue contains an unplayable song.');
  await TrackPlayer.add(playableQueue.map(toTrackPlayerTrack));
  if (snapshot.activeIndex >= 0) await TrackPlayer.skip(snapshot.activeIndex);
  await TrackPlayer.seekTo(snapshot.progressSeconds);
  if (snapshot.playbackState === 'playing') await TrackPlayer.play();
  else if (snapshot.playbackState === 'paused') await TrackPlayer.pause();
  else if (snapshot.playbackState === 'stopped') await TrackPlayer.stop();
};

const ROLLBACK_PROGRESS_TOLERANCE_SECONDS = 0.25;

export const verifyNativeQueueRollback = (
  snapshot: NativeQueueMutationSnapshot,
  readback: NativeQueueReadback,
): void => {
  if (!hasSameNormalizedQueueOrder(snapshot.nativeQueue, readback.queue)) throw new Error('Rollback queue order differs from snapshot.');
  if (snapshot.activeTrackId !== readback.activeTrackId) throw new Error('Rollback active track differs from snapshot.');
  if (snapshot.activeIndex !== readback.activeIndex) throw new Error('Rollback active index differs from snapshot.');
  if (Math.abs(snapshot.progressSeconds - readback.progressSeconds) > ROLLBACK_PROGRESS_TOLERANCE_SECONDS) {
    throw new Error('Rollback progress differs from snapshot.');
  }
  if (snapshot.playbackState !== 'unknown' && snapshot.playbackState !== readback.playbackState) {
    throw new Error('Rollback playback state differs from snapshot.');
  }
};

interface RecoveryArgs {
  originalError: unknown;
  snapshot: NativeQueueMutationSnapshot;
  knownSongs: Song[];
  librarySongs: Song[];
  targets: NativeQueueStateTargets;
  preferredBaseQueue?: Song[];
  reconciliationShuffleStrategy: NativeQueueShuffleStrategy;
  persistCurrentSong?: boolean;
}

const reconcileReadback = async (
  status: 'reconciled' | 'rolled-back',
  readback: NativeQueueReadback,
  args: RecoveryArgs,
  diagnostics: NativeQueueRecoveryDiagnostics,
): Promise<NativeQueueRecoveryResult> => ({
  status,
  ...await commitNativeQueueTruth({
    readback,
    preferredBaseQueue: status === 'rolled-back' ? args.snapshot.baseQueue : args.preferredBaseQueue ?? args.snapshot.baseQueue,
    librarySongs: args.librarySongs,
    targets: args.targets,
    shuffleStrategy: status === 'rolled-back'
      ? { kind: 'restore-snapshot', enabled: args.snapshot.shuffleEnabled }
      : args.reconciliationShuffleStrategy,
    persistCurrentSong: args.persistCurrentSong,
  }),
  diagnostics,
});

export const recoverNativeQueueMutation = async (args: RecoveryArgs): Promise<NativeQueueRecoveryResult> => {
  const diagnostics: NativeQueueRecoveryDiagnostics = { originalError: args.originalError };
  try {
    return await reconcileReadback('reconciled', await readNativeQueueTruth(args.knownSongs), args, diagnostics);
  } catch (error) {
    diagnostics.initialReadbackError = error;
  }
  try {
    await executeNativeQueueRollback(args.snapshot);
  } catch (error) {
    diagnostics.rollbackExecutionError = error;
  }
  if (!diagnostics.rollbackExecutionError) {
    try {
      const readback = await readNativeQueueTruth(args.knownSongs);
      verifyNativeQueueRollback(args.snapshot, readback);
      return reconcileReadback('rolled-back', readback, args, diagnostics);
    } catch (error) {
      diagnostics.rollbackVerificationError = error;
    }
  }
  try {
    const finalReadback = await readNativeQueueTruth(args.knownSongs);
    return reconcileReadback('reconciled', finalReadback, args, diagnostics);
  } catch (error) {
    diagnostics.finalReadbackError = error;
    return { status: 'failed', diagnostics };
  }
};
