import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { Playlist, Song } from '../types/Song';
import { prunePlaylists } from '../utils/playlistState';
import { hasSameOrderedSongIds } from '../utils/playbackQueue';
import { toPlayableSongs } from '../utils/playableSong';
import { StorageKeys, storage } from '../utils/storage';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';
import { runExclusiveNativeQueueReplacement } from '../utils/nativeQueueMutationLock';
import {
  mergeUniqueSongs,
  patchNullableSongById,
  patchSongById,
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

export interface LibraryActions {
  setSongs: (songs: Song[]) => void;
  addSongs: (songs: Song[]) => void;
  updateSongMetadata: (songId: string, patch: Partial<Song>) => void;
}

export { mergeUniqueSongs, patchSongById } from './libraryActionHelpers';


const cleanupCurrentSongIdAfterLibraryUpdate = async (
  validSongIds: ReadonlySet<string>,
  cleanupVersion: number,
  latestCleanupVersionRef: MutableRefObject<number>,
): Promise<void> => {
  const isStaleCleanup = () => latestCleanupVersionRef.current !== cleanupVersion;

  try {
    if (isStaleCleanup()) return;
    const currentSongId = await storage.get<string>(StorageKeys.CURRENT_SONG_ID);
    if (isStaleCleanup()) return;
    const normalizedCurrentSongId = currentSongId?.trim();
    if (normalizedCurrentSongId && !validSongIds.has(normalizedCurrentSongId)) {
      if (isStaleCleanup()) return;
      await storage.remove(StorageKeys.CURRENT_SONG_ID);
    }
  } catch (error) {
    if (isStaleCleanup()) return;
    console.warn('[LibraryRemove] Failed to clear current song id after removal.', error);
  }
};

const syncNativeQueueToLibrary = async (
  nativeQueueRef: MutableRefObject<Song[]>,
  nextQueue: Song[],
  syncVersion: number,
  latestSyncVersionRef: MutableRefObject<number>,
): Promise<boolean> => {
  const playableQueue = toPlayableSongs(nextQueue);
  const isStaleSync = () => latestSyncVersionRef.current !== syncVersion;

  try {
    const applied = await runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      if (isStaleSync() || !isCurrent()) return false;

      await TrackPlayer.reset();

      if (isStaleSync() || !isCurrent()) {
        nativeQueueRef.current = [];
        return false;
      }

      if (playableQueue.length > 0) {
        await TrackPlayer.add(playableQueue.map(toTrackPlayerTrack));
        nativeQueueRef.current = playableQueue.slice();
      }

      if (isStaleSync() || !isCurrent()) return false;

      if (playableQueue.length === 0) nativeQueueRef.current = [];
      return true;
    });
    return applied && !isStaleSync();
  } catch (error) {
    if (isStaleSync()) return false;
    console.warn('[LibraryRemove] Failed to sync native queue after library update.', error);
    return false;
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
      setCurrentSong(prev => pruneNullableSongByValidIds(prev, validSongIds));
      const nextQueueRef = pruneSongsByValidIds(queueContextRef.current, validSongIds);
      const nextBaseQueueRef = pruneSongsByValidIds(baseQueueContextRef.current, validSongIds);
      const nextNativeQueueRef = pruneSongsByValidIds(nativeQueueRef.current, validSongIds);
      const queueRefChanged = !hasSameOrderedSongIds(queueContextRef.current, nextQueueRef);
      const baseQueueRefChanged = !hasSameOrderedSongIds(baseQueueContextRef.current, nextBaseQueueRef);
      const nativeQueueRefChanged = !hasSameOrderedSongIds(nativeQueueRef.current, nextNativeQueueRef);

      const commitQueueRefs = () => {
        if (queueRefChanged) queueContextRef.current = nextQueueRef;
        if (baseQueueRefChanged) baseQueueContextRef.current = nextBaseQueueRef;
        const syncedQueue = queueContextRef.current.slice();
        if (queueRefChanged) {
          setPlaybackQueue(syncedQueue);
        } else {
          setPlaybackQueue(prev => pruneSongsByValidIds(prev, validSongIds));
        }
      };
      setSongsState(songs);
      latestCleanupVersionRef.current += 1;
      const cleanupVersion = latestCleanupVersionRef.current;
      void cleanupCurrentSongIdAfterLibraryUpdate(validSongIds, cleanupVersion, latestCleanupVersionRef);
      if (queueRefChanged || nativeQueueRefChanged) {
        latestNativeSyncVersionRef.current += 1;
        const syncVersion = latestNativeSyncVersionRef.current;
        void syncNativeQueueToLibrary(nativeQueueRef, nextQueueRef, syncVersion, latestNativeSyncVersionRef).then(didSync => {
          if (!didSync || latestNativeSyncVersionRef.current !== syncVersion) return;
          commitQueueRefs();
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

  const updateSongMetadata = useCallback(
    (songId: string, patch: Partial<Song>) => {
      const patchSong = patchSongById(songId, patch);
      setSongsState(prev => prev.map(patchSong));
      setCurrentSong(prev => patchNullableSongById(songId, patch, prev));
      setPlaybackQueue(prev => prev.map(patchSong));
      patchSongRefs(patchSong, [queueContextRef, baseQueueContextRef, nativeQueueRef]);
      updateNativeMetadataForSong(songId, nativeQueueRef, baseQueueContextRef);
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

  return { setSongs, addSongs, updateSongMetadata };
};
