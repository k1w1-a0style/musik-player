import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { Song } from '../types/Song';
import { StorageKeys, storage } from '../utils/storage';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';

interface ApplyPlaybackQueueStateArgs {
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  setPlaybackQueue: Dispatch<SetStateAction<Song[]>>;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  orderedQueue: Song[];
  baseQueue: Song[];
  selectedSong?: Song;
}

export const getCurrentQueueSnapshot = (queueContext: Song[], librarySongs: Song[]): Song[] =>
  (queueContext.length > 0 ? queueContext : librarySongs.filter(song => !!song.uri)).slice();

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

export const applyPlaybackQueueState = ({
  queueContextRef,
  baseQueueContextRef,
  setPlaybackQueue,
  setCurrentSong,
  orderedQueue,
  baseQueue,
  selectedSong,
}: ApplyPlaybackQueueStateArgs): void => {
  queueContextRef.current = orderedQueue;
  baseQueueContextRef.current = baseQueue.slice();
  setPlaybackQueue(orderedQueue);
  if (selectedSong) setCurrentSong(selectedSong);
};

export const rebuildNativePlaybackQueue = async (
  queue: Song[],
  nativeQueueRef: MutableRefObject<Song[]>,
  resumePositionSeconds?: number,
): Promise<void> => {
  await TrackPlayer.reset();
  await TrackPlayer.add(queue.map(toTrackPlayerTrack));
  nativeQueueRef.current = queue.slice();
  if (resumePositionSeconds) await TrackPlayer.seekTo(resumePositionSeconds);
  await TrackPlayer.play();
};
