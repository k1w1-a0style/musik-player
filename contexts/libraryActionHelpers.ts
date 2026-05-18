import type { MutableRefObject } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { Song } from '../types/Song';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';

export const mergeUniqueSongs = (currentSongs: Song[], newSongs: Song[]): Song[] => {
  const existing = new Set(currentSongs.map(song => song.id));
  return [...currentSongs, ...newSongs.filter(song => !existing.has(song.id))];
};

export const patchSongById = (songId: string, patch: Partial<Song>) => (song: Song): Song =>
  song.id === songId ? { ...song, ...patch } : song;

export const patchNullableSongById = (
  songId: string,
  patch: Partial<Song>,
  song: Song | null,
): Song | null => (song?.id === songId ? { ...song, ...patch } : song);

export const patchSongRefs = (
  patchSong: (song: Song) => Song,
  refs: Array<MutableRefObject<Song[]>>,
): void => {
  refs.forEach(ref => {
    ref.current = ref.current.map(patchSong);
  });
};

export const updateNativeMetadataForSong = (
  songId: string,
  nativeQueueRef: MutableRefObject<Song[]>,
  baseQueueContextRef: MutableRefObject<Song[]>,
): void => {
  const queueIndex = nativeQueueRef.current.findIndex(song => song.id === songId);
  const queuedPatchedSong =
    (queueIndex >= 0 ? nativeQueueRef.current[queueIndex] : undefined) ??
    baseQueueContextRef.current.find(song => song.id === songId);
  if (!queuedPatchedSong || queueIndex < 0) return;

  void TrackPlayer.updateMetadataForTrack(queueIndex, toTrackPlayerTrack(queuedPatchedSong)).catch(
    () => undefined,
  );
};
