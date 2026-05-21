import type { MutableRefObject } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { Song } from '../types/Song';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const normalizeSongUriForLibraryDedupe = (song: Song): string | undefined => {
  const uri = song.fileInfo?.uri ?? song.uri;
  if (!uri) return undefined;
  const withoutQuery = uri.split(/[?#]/)[0] ?? uri;
  return safeDecode(withoutQuery).replace(/\\/g, '/').replace(/\/+$/, '') || undefined;
};

export const mergeUniqueSongs = (currentSongs: Song[], newSongs: Song[]): Song[] => {
  const existingIds = new Set(currentSongs.map(song => song.id));
  const existingUris = new Set(
    currentSongs.flatMap(song => {
      const uri = normalizeSongUriForLibraryDedupe(song);
      return uri ? [uri] : [];
    }),
  );
  const merged = [...currentSongs];

  for (const song of newSongs) {
    const normalizedUri = normalizeSongUriForLibraryDedupe(song);
    if (existingIds.has(song.id)) continue;
    if (normalizedUri && existingUris.has(normalizedUri)) continue;
    existingIds.add(song.id);
    if (normalizedUri) existingUris.add(normalizedUri);
    merged.push(song);
  }

  return merged;
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