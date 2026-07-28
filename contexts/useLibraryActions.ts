import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { Playlist, Song } from '../types/Song';
import {
  assertCurrentSongPersistenceSucceeded,
  persistCurrentSongIdSerialized,
} from '../utils/currentSongPersistence';
import { prunePlaylists } from '../utils/playlistState';
import { hasSameOrderedSongIds } from '../utils/playbackQueue';
import { toPlayableSongs } from '../utils/playableSong';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';
import { runExclusiveNativeQueueReplacement } from '../utils/nativeQueueMutationLock';
import {
  mergeUniqueSongs,
  normalizeSongIdForLibrary,
  patchSongRefs,
  pruneNullableSongByValidIds,
  pruneSongsByValidIds,
  updateNativeMetadataForSong,
} from './libraryActionHelpers';

export interface LibraryActionsArgs {
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  nativeQueueRef: MutableRefObject<Song[]>;
  setSongsState: Dispatch<SetStateAction<Song[]>>;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  setPlaybackQueue: Dispatch<SetStateAction<Song[]>>;
  setPlaylists: Dispatch<SetStateAction<Playlist[]>>;
}

export type SongMetadataPatchesById = Record<string, Partial<Song>>;

export interface LibraryActions {
  setSongs: (songs: Song[]) => void;
  addSongs: (songs: Song[]) => void;
  updateSongMetadata: (songId: string, patch: Partial<Song>) => void;
  applySongMetadataPatches: (patchesBySongId: SongMetadataPatchesById) => void;
}

export { mergeUniqueSongs, patchSongById } from './libraryActionHelpers';



const normalizeMetadataPatchMap = (patchesBySongId: SongMetadataPatchesById): Map<string, Partial<Song>> => {
  const normalized = new Map<string, Partial<Song>>();
  Object.entries(patchesBySongId).forEach(([songId, patch]) => {
    const normalizedSongId = normalizeSongIdForLibrary(songId);
    if (!normalizedSongId || Object.keys(patch).length === 0) return;
    normalized.set(normalizedSongId, patch);
  });
  return normalized;
};

const patchSongByMetadataPatchMap = (patchesByNormalizedSongId: ReadonlyMap<string, Partial<Song>>) => (song: Song): Song => {
  const normalizedSongId = normalizeSongIdForLibrary(song.id);
  if (!normalizedSongId) return song;
  const patch = patchesByNormalizedSongId.get(normalizedSongId);
  if (!patch) return song;

  let changed = song.id !== normalizedSongId;
  const next: Song = { ...song, ...(song.id === normalizedSongId ? {} : { id: normalizedSongId }) };
  (Object.keys(patch) as Array<keyof Song>).forEach(key => {
    const value = patch[key];
    if (next[key] !== value) {
      (next as Record<keyof Song, unknown>)[key] = value;
      changed = true;
    }
  });
  return changed ? next : song;
};

const patchSongsArray = (songs: Song[], patchSong: (song: Song) => Song): Song[] => {
  let changed = false;
  const next = songs.map(song => {
    const patched = patchSong(song);
    if (patched !== song) changed = true;
    return patched;
  });
  return changed ? next : songs;
};

const cleanupCurrentSongIdAfterLibraryUpdate = async (
  validSongIds: ReadonlySet<string>,
  cleanupVersion: number,
  latestCleanupVersionRef: MutableRefObject<number>,
): Promise<void> => {
  const isStaleCleanup = () => latestCleanupVersionRef.current !== cleanupVersion;

  try {
    if (isStaleCleanup()) return;
    const result = await persistCurrentSongIdSerialized({
      isCurrent: () => !isStaleCleanup(),
      resolveDesiredId: persistedId =>
        persistedId && !validSongIds.has(persistedId) ? null : undefined,
    });
    if (isStaleCleanup()) return;
    assertCurrentSongPersistenceSucceeded(result);
  } catch (error) {
    if (isStaleCleanup()) return;
    console.warn('[LibraryRemove] Failed to clear current song id after removal.', error);
  }
};

type NativeQueueLibrarySyncResult = 'applied' | 'failed' | 'resetThenFailed' | 'stale';

const syncNativeQueueToLibrary = async (
  nativeQueueRef: MutableRefObject<Song[]>,
  nextQueue: Song[],
  syncVersion: number,
  latestSyncVersionRef: MutableRefObject<number>,
): Promise<NativeQueueLibrarySyncResult> => {
  const playableQueue = toPlayableSongs(nextQueue);
  const isStaleSync = () => latestSyncVersionRef.current !== syncVersion;

  let didResetNativeQueue = false;

  try {
    const applied = await runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      if (isStaleSync() || !isCurrent()) return false;

      await TrackPlayer.reset();
      didResetNativeQueue = true;
      nativeQueueRef.current = [];

      if (isStaleSync() || !isCurrent()) {
        return false;
      }

      if (playableQueue.length > 0) {
        await TrackPlayer.add(playableQueue.map(toTrackPlayerTrack));
        // The bridge call cannot be cancelled. Reflect the real native queue
        // before handing the React commit to a newer library-sync version.
        nativeQueueRef.current = playableQueue.slice();
        if (isStaleSync() || !isCurrent()) return false;
      }

      if (isStaleSync() || !isCurrent()) return false;

      return true;
    });
    return applied && !isStaleSync() ? 'applied' : 'stale';
  } catch (error) {
    if (didResetNativeQueue) nativeQueueRef.current = [];
    if (isStaleSync()) return 'stale';
    console.warn('[LibraryRemove] Failed to sync native queue after library update.', error);
    return didResetNativeQueue ? 'resetThenFailed' : 'failed';
  }
};
export const useLibraryActions = ({
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  setSongsState,
  setCurrentSong,
  setPlaybackQueue,
  setPlaylists,
}: LibraryActionsArgs): LibraryActions => {
  const latestNativeSyncVersionRef = useRef(0);
  const latestCleanupVersionRef = useRef(0);

  const setSongs = useCallback(
    (songs: Song[]) => {
      const validSongIds = new Set(songs.map(song => song.id));
      setPlaylists(prev => prunePlaylists(prev, validSongIds));
      const nextQueueRef = pruneSongsByValidIds(queueContextRef.current, validSongIds);
      const queueRefChanged = !hasSameOrderedSongIds(queueContextRef.current, nextQueueRef);
      const nativeQueueRefChanged = !hasSameOrderedSongIds(nativeQueueRef.current, nextQueueRef);
      latestNativeSyncVersionRef.current += 1;
      const syncVersion = latestNativeSyncVersionRef.current;

      const commitCurrentSongAndPersistenceCleanup = () => {
        setCurrentSong(prev => pruneNullableSongByValidIds(prev, validSongIds));
        latestCleanupVersionRef.current += 1;
        const cleanupVersion = latestCleanupVersionRef.current;
        void cleanupCurrentSongIdAfterLibraryUpdate(
          validSongIds,
          cleanupVersion,
          latestCleanupVersionRef,
        );
      };
      const commitQueueRefs = () => {
        queueContextRef.current = pruneSongsByValidIds(queueContextRef.current, validSongIds);
        baseQueueContextRef.current = pruneSongsByValidIds(baseQueueContextRef.current, validSongIds);
        setPlaybackQueue(queueContextRef.current.slice());
        commitCurrentSongAndPersistenceCleanup();
      };
      const commitClearedQueueRefs = () => {
        queueContextRef.current = [];
        baseQueueContextRef.current = [];
        setPlaybackQueue([]);
        commitCurrentSongAndPersistenceCleanup();
      };
      setSongsState(songs);
      if (queueRefChanged || nativeQueueRefChanged) {
        void syncNativeQueueToLibrary(nativeQueueRef, nextQueueRef, syncVersion, latestNativeSyncVersionRef).then(syncResult => {
          if (latestNativeSyncVersionRef.current !== syncVersion) return;
          if (syncResult === 'applied') {
            commitQueueRefs();
            return;
          }
          if (syncResult === 'resetThenFailed') {
            commitClearedQueueRefs();
            return;
          }
          if (syncResult === 'failed') {
            // reset() failed before the native queue changed. Keep the JS queue and
            // current-song state aligned with the still-active native queue instead
            // of pretending the removal was synchronized.
            return;
          }
          // A stale replacement is owned by a newer queue mutation. It must not
          // commit any state from this older library update.
        });
      } else {
        commitQueueRefs();
      }
    },
    [
      baseQueueContextRef,
      nativeQueueRef,
      queueContextRef,
      setCurrentSong,
      setPlaybackQueue,
      setPlaylists,
      setSongsState,
    ],
  );

  const addSongs = useCallback(
    (songs: Song[]) => {
      setSongsState(prev => mergeUniqueSongs(prev, songs));
    },
    [setSongsState],
  );

  const applySongMetadataPatches = useCallback(
    (patchesBySongId: SongMetadataPatchesById) => {
      const patchesByNormalizedSongId = normalizeMetadataPatchMap(patchesBySongId);
      if (patchesByNormalizedSongId.size === 0) return;
      const patchSong = patchSongByMetadataPatchMap(patchesByNormalizedSongId);
      const affectedNativeSongIds = new Set<string>();
      nativeQueueRef.current.forEach(song => {
        const songId = normalizeSongIdForLibrary(song.id);
        if (songId && patchesByNormalizedSongId.has(songId)) affectedNativeSongIds.add(songId);
      });

      setSongsState(prev => patchSongsArray(prev, patchSong));
      setCurrentSong(prev => (prev ? patchSong(prev) : null));
      setPlaybackQueue(prev => patchSongsArray(prev, patchSong));
      const affectedChangedNativeSongIds = new Set<string>();
      const trackNativeChange = (song: Song): Song => {
        const patched = patchSong(song);
        const songId = normalizeSongIdForLibrary(song.id);
        if (patched !== song && songId && affectedNativeSongIds.has(songId)) affectedChangedNativeSongIds.add(songId);
        return patched;
      };
      patchSongRefs(trackNativeChange, [queueContextRef, baseQueueContextRef, nativeQueueRef]);
      affectedChangedNativeSongIds.forEach(songId => updateNativeMetadataForSong(songId, nativeQueueRef, baseQueueContextRef));
    },
    [
      baseQueueContextRef,
      nativeQueueRef,
      queueContextRef,
      setCurrentSong,
      setPlaybackQueue,
      setSongsState,
    ],
  );

  const updateSongMetadata = useCallback(
    (songId: string, patch: Partial<Song>) => {
      applySongMetadataPatches({ [songId]: patch });
    },
    [applySongMetadataPatches],
  );

  return { setSongs, addSongs, updateSongMetadata, applySongMetadataPatches };
};
