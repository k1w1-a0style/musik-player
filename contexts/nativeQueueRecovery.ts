import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import TrackPlayer, { State, type Track } from 'react-native-track-player';
import type { Song } from '../types/Song';
import { StorageKeys, storage } from '../utils/storage';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';
import type { PlayableSong } from '../utils/playableSong';

const normalizedId = (value: unknown): string | undefined => {
  const id = String(value ?? '').trim();
  return id || undefined;
};

const findKnownSong = (songs: Song[], id: unknown): Song | undefined => {
  const wanted = normalizedId(id);
  return wanted ? songs.find(song => normalizedId(song.id) === wanted) : undefined;
};

export interface NativeQueueMutationSnapshot {
  nativeQueue: Song[];
  logicalQueue: Song[];
  baseQueue: Song[];
  currentSong: Song | null;
  persistedCurrentSongId: string | null;
  activeTrackId: string | null;
  activeIndex: number;
  progressSeconds: number;
  shuffleEnabled: boolean;
  wasPlaying: boolean;
}

export type NativeQueueRecoveryResult =
  | { status: 'reconciled'; queue: Song[]; baseQueue: Song[]; activeSong: Song | null; shuffleEnabled: boolean; persistenceError?: unknown }
  | { status: 'rolled-back'; queue: Song[]; baseQueue: Song[]; activeSong: Song | null; shuffleEnabled: boolean; persistenceError?: unknown }
  | { status: 'failed'; originalError: unknown; readbackError?: unknown; rollbackError?: unknown; finalReadbackError?: unknown };

export interface NativeQueueStateTargets {
  nativeQueueRef: MutableRefObject<Song[]>;
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  setPlaybackQueue: Dispatch<SetStateAction<Song[]>>;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  shuffleRef?: MutableRefObject<boolean>;
  setShuffle?: Dispatch<SetStateAction<boolean>>;
}

interface NativeReadback {
  queue: Song[];
  activeSong: Song | null;
}

const mapNativeTracks = (tracks: Track[], knownSongs: Song[]): Song[] => tracks.map(track => {
  const song = findKnownSong(knownSongs, track.id);
  if (!song) throw new Error(`Native queue readback contained unknown track "${String(track.id)}".`);
  return song;
});

export const readNativeQueueTruth = async (knownSongs: Song[]): Promise<NativeReadback> => {
  const tracks = await TrackPlayer.getQueue();
  const activeTrack = await TrackPlayer.getActiveTrack();
  const queue = mapNativeTracks(tracks, knownSongs);
  const activeSong = activeTrack ? findKnownSong(queue, activeTrack.id) : undefined;
  if (activeTrack && !activeSong) throw new Error(`Active native track "${String(activeTrack.id)}" is unknown.`);
  return { queue, activeSong: activeSong ?? queue[0] ?? null };
};

export const createNativeQueueMutationSnapshot = async ({
  knownSongs,
  currentSong,
  shuffleEnabled,
  targets,
}: {
  knownSongs: Song[];
  currentSong: Song | null;
  shuffleEnabled: boolean;
  targets: NativeQueueStateTargets;
}): Promise<NativeQueueMutationSnapshot> => {
  const candidates = [...knownSongs, ...targets.nativeQueueRef.current];
  const tracks = await TrackPlayer.getQueue();
  const activeTrack = await TrackPlayer.getActiveTrack();
  const nativeQueue = mapNativeTracks(tracks, candidates);
  const [progress, playbackState, persistedCurrentSongId] = await Promise.all([
    TrackPlayer.getProgress(),
    TrackPlayer.getPlaybackState(),
    storage.getCurrentSongId(),
  ]);
  const activeTrackId = normalizedId(activeTrack?.id) ?? null;
  return {
    nativeQueue,
    logicalQueue: targets.queueContextRef.current.slice(),
    baseQueue: targets.baseQueueContextRef.current.slice(),
    currentSong: currentSong ?? findKnownSong(candidates, activeTrackId) ?? null,
    persistedCurrentSongId,
    activeTrackId,
    activeIndex: activeTrackId ? nativeQueue.findIndex(song => normalizedId(song.id) === activeTrackId) : -1,
    progressSeconds: progress.position,
    shuffleEnabled,
    wasPlaying: playbackState.state === State.Playing,
  };
};

const sameSongSet = (left: Song[], right: Song[]): boolean => left.length === right.length
  && left.every(song => findKnownSong(right, song.id));

export const deriveRecoveredShuffleState = (queue: Song[], baseQueue: Song[]): boolean =>
  sameSongSet(queue, baseQueue)
  && queue.some((song, index) => normalizedId(song.id) !== normalizedId(baseQueue[index]?.id));

const persistActiveSong = async (activeSong: Song | null, librarySongs: Song[]): Promise<unknown | undefined> => {
  try {
    const inLibrary = activeSong && findKnownSong(librarySongs, activeSong.id);
    const confirmed = inLibrary
      ? await storage.set(StorageKeys.CURRENT_SONG_ID, normalizedId(activeSong.id))
      : await (storage.remove(StorageKeys.CURRENT_SONG_ID) as Promise<unknown>);
    if (confirmed === false) throw new Error('Current-song persistence was not confirmed.');
    return undefined;
  } catch (error) {
    return error;
  }
};

const chooseSemanticBaseQueue = (queue: Song[], preferredBase: Song[]): Song[] =>
  queue.length > 0 && queue.every(song => findKnownSong(preferredBase, song.id))
    ? preferredBase.slice()
    : queue.slice();

export const commitNativeQueueTruth = async ({
  readback,
  preferredBaseQueue,
  librarySongs,
  targets,
}: {
  readback: NativeReadback;
  preferredBaseQueue: Song[];
  librarySongs: Song[];
  targets: NativeQueueStateTargets;
}): Promise<Omit<Extract<NativeQueueRecoveryResult, { status: 'reconciled' }>, 'status'>> => {
  const queue = readback.queue.slice();
  const baseQueue = chooseSemanticBaseQueue(queue, preferredBaseQueue);
  const shuffleEnabled = deriveRecoveredShuffleState(queue, baseQueue);
  targets.nativeQueueRef.current = queue.slice();
  targets.queueContextRef.current = queue.slice();
  targets.baseQueueContextRef.current = baseQueue.slice();
  targets.setPlaybackQueue(queue.slice());
  targets.setCurrentSong(readback.activeSong);
  if (targets.shuffleRef) targets.shuffleRef.current = shuffleEnabled;
  targets.setShuffle?.(shuffleEnabled);
  const persistenceError = await persistActiveSong(readback.activeSong, librarySongs);
  return { queue, baseQueue, activeSong: readback.activeSong, shuffleEnabled, persistenceError };
};

export const rollbackNativeQueueSnapshot = async (snapshot: NativeQueueMutationSnapshot): Promise<void> => {
  await TrackPlayer.reset();
  if (snapshot.nativeQueue.length > 0) {
    await TrackPlayer.add(snapshot.nativeQueue.map(song => toTrackPlayerTrack(song as PlayableSong)));
  }
  if (snapshot.activeIndex > 0) await TrackPlayer.skip(snapshot.activeIndex);
  if (snapshot.progressSeconds > 0 && snapshot.nativeQueue.length > 0) await TrackPlayer.seekTo(snapshot.progressSeconds);
  if (snapshot.nativeQueue.length > 0) {
    if (snapshot.wasPlaying) await TrackPlayer.play();
    else await TrackPlayer.pause();
  }
};

export const recoverNativeQueueMutation = async ({
  originalError,
  snapshot,
  knownSongs,
  librarySongs,
  targets,
  preferredBaseQueue = snapshot.baseQueue,
}: {
  originalError: unknown;
  snapshot: NativeQueueMutationSnapshot;
  knownSongs: Song[];
  librarySongs: Song[];
  targets: NativeQueueStateTargets;
  preferredBaseQueue?: Song[];
}): Promise<NativeQueueRecoveryResult> => {
  let readbackError: unknown;
  try {
    const readback = await readNativeQueueTruth(knownSongs);
    return { status: 'reconciled', ...await commitNativeQueueTruth({ readback, preferredBaseQueue, librarySongs, targets }) };
  } catch (error) {
    readbackError = error;
  }

  let rollbackError: unknown;
  try {
    await rollbackNativeQueueSnapshot(snapshot);
    const verified = await readNativeQueueTruth(knownSongs);
    return { status: 'rolled-back', ...await commitNativeQueueTruth({
      readback: verified, preferredBaseQueue: snapshot.baseQueue, librarySongs, targets,
    }) };
  } catch (error) {
    rollbackError = error;
  }

  try {
    const finalReadback = await readNativeQueueTruth(knownSongs);
    return { status: 'reconciled', ...await commitNativeQueueTruth({
      readback: finalReadback, preferredBaseQueue, librarySongs, targets,
    }) };
  } catch (finalReadbackError) {
    return { status: 'failed', originalError, readbackError, rollbackError, finalReadbackError };
  }
};
