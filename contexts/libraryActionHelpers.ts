import type { MutableRefObject } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { Song } from '../types/Song';
import { asPlayableSong } from '../utils/playableSong';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const normalizeSongIdForLibrary = (songId?: string): string | undefined => {
  const trimmed = songId?.trim();
  return trimmed || undefined;
};

export const normalizeSongUriForLibraryDedupe = (song: Song): string | undefined => {
  const uri = song.fileInfo?.uri ?? song.uri;
  if (!uri) return undefined;
  const withoutQuery = uri.split(/[?#]/)[0] ?? uri;
  return safeDecode(withoutQuery).replace(/\\/g, '/').replace(/\/+$/, '') || undefined;
};

const normalizeValidSongIds = (validSongIds: Set<string>): Set<string> => {
  const normalized = new Set<string>();
  validSongIds.forEach(songId => {
    const id = normalizeSongIdForLibrary(songId);
    if (id) normalized.add(id);
  });
  return normalized;
};

export const mergeUniqueSongs = (currentSongs: Song[], newSongs: Song[]): Song[] => {
  const existingIds = new Set(currentSongs.flatMap(song => {
    const id = normalizeSongIdForLibrary(song.id);
    return id ? [id] : [];
  }));
  const existingUris = new Set(
    currentSongs.flatMap(song => {
      const uri = normalizeSongUriForLibraryDedupe(song);
      return uri ? [uri] : [];
    }),
  );
  const merged = [...currentSongs];

  for (const song of newSongs) {
    const normalizedId = normalizeSongIdForLibrary(song.id);
    const normalizedUri = normalizeSongUriForLibraryDedupe(song);
    if (!normalizedId) continue;
    if (existingIds.has(normalizedId)) continue;
    if (normalizedUri && existingUris.has(normalizedUri)) continue;
    existingIds.add(normalizedId);
    if (normalizedUri) existingUris.add(normalizedUri);
    merged.push(song.id === normalizedId ? song : { ...song, id: normalizedId });
  }

  return merged;
};

export const pruneSongsByValidIds = (songs: Song[], validSongIds: Set<string>): Song[] => {
  const normalizedValidSongIds = normalizeValidSongIds(validSongIds);
  let changed = false;
  const next = songs.flatMap(song => {
    const id = normalizeSongIdForLibrary(song.id);
    const keep = !!id && normalizedValidSongIds.has(id);
    if (!keep) {
      changed = true;
      return [];
    }
    if (id !== song.id) {
      changed = true;
      return [{ ...song, id }];
    }
    return [song];
  });
  return changed ? next : songs;
};

export const pruneNullableSongByValidIds = (
  song: Song | null,
  validSongIds: Set<string>,
): Song | null => {
  if (!song) return null;
  const id = normalizeSongIdForLibrary(song.id);
  if (!id || !normalizeValidSongIds(validSongIds).has(id)) return null;
  return id === song.id ? song : { ...song, id };
};

export const syncSongRefsToLibrary = (
  validSongIds: Set<string>,
  refs: Array<MutableRefObject<Song[]>>,
): void => {
  refs.forEach(ref => {
    ref.current = pruneSongsByValidIds(ref.current, validSongIds);
  });
};


export const patchSongById = (songId: string, patch: Partial<Song>) => (song: Song): Song => {
  const targetSongId = normalizeSongIdForLibrary(songId);
  const currentSongId = normalizeSongIdForLibrary(song.id);
  if (!targetSongId || currentSongId !== targetSongId) return song;
  return { ...song, ...(song.id === currentSongId ? {} : { id: currentSongId }), ...patch };
};

export const patchNullableSongById = (
  songId: string,
  patch: Partial<Song>,
  song: Song | null,
): Song | null => (song ? patchSongById(songId, patch)(song) : null);

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
  const targetSongId = normalizeSongIdForLibrary(songId);
  if (!targetSongId) return;
  const queueIndex = nativeQueueRef.current.findIndex(song => normalizeSongIdForLibrary(song.id) === targetSongId);
  const queuedPatchedSong =
    (queueIndex >= 0 ? nativeQueueRef.current[queueIndex] : undefined) ??
    baseQueueContextRef.current.find(song => normalizeSongIdForLibrary(song.id) === targetSongId);
  if (!queuedPatchedSong || queueIndex < 0) return;

  const playableQueuedSong = asPlayableSong(queuedPatchedSong);
  if (!playableQueuedSong) {
    console.warn('[TrackPlayer] Skipping metadata update for non-playable queued song.', {
      songId: targetSongId,
      queueIndex,
    });
    return;
  }
  void TrackPlayer.updateMetadataForTrack(queueIndex, toTrackPlayerTrack(playableQueuedSong)).catch(
    error => {
      console.warn('[TrackPlayer] Failed to update native track metadata.', {
        songId: targetSongId,
        queueIndex,
        error,
      });
    },
  );
};
