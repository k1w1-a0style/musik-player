import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { Playlist, Song } from '../types/Song';
import { prunePlaylists } from '../utils/playlistState';
import { toPlayableSongs } from '../utils/playableSong';
import { StorageKeys, storage } from '../utils/storage';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';
import {
  mergeUniqueSongs,
  patchNullableSongById,
  patchSongById,
  patchSongRefs,
  pruneNullableSongByValidIds,
  hasSameSongIds,
  pruneSongsByValidIds,
  updateNativeMetadataForSong,
} from './libraryActionHelpers';

interface LibraryActionsArgs {
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  nativeQueueRef: MutableRefObject<Song[]>;
  setSongsState: Dispatch<SetStateAction<Song[]>>;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  setPlaybackQueue: Dispatch<SetStateAction<Song[]>>;
  setPlaylists: Dispatch<SetStateAction<Playlist[]>>;
}

interface LibraryActions {
  setSongs: (songs: Song[]) => void;
  addSongs: (songs: Song[]) => void;
  updateSongMetadata: (songId: string, patch: Partial<Song>) => void;
}

export { mergeUniqueSongs, patchSongById } from './libraryActionHelpers';



const syncNativeQueueToLibrary = async (
  nativeQueueRef: MutableRefObject<Song[]>,
  nextQueue: Song[],
): Promise<void> => {
  const playableQueue = toPlayableSongs(nextQueue);
  try {
    await TrackPlayer.reset();
    if (playableQueue.length > 0) {
      await TrackPlayer.add(playableQueue.map(toTrackPlayerTrack));
    }
    nativeQueueRef.current = playableQueue.slice();
  } catch (error) {
    nativeQueueRef.current = [];
    console.warn('[LibraryRemove] Failed to sync native queue after library update.', error);
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
  const setSongs = useCallback(
    (songs: Song[]) => {
      const validSongIds = new Set(songs.map(song => song.id));
      setPlaylists(prev => prunePlaylists(prev, validSongIds));
      setCurrentSong(prev => pruneNullableSongByValidIds(prev, validSongIds));
      const nextQueueRef = pruneSongsByValidIds(queueContextRef.current, validSongIds);
      const nextBaseQueueRef = pruneSongsByValidIds(baseQueueContextRef.current, validSongIds);
      const nextNativeQueueRef = pruneSongsByValidIds(nativeQueueRef.current, validSongIds);
      const queueRefChanged = !hasSameSongIds(queueContextRef.current, nextQueueRef);
      const baseQueueRefChanged = !hasSameSongIds(baseQueueContextRef.current, nextBaseQueueRef);
      const nativeQueueRefChanged = !hasSameSongIds(nativeQueueRef.current, nextNativeQueueRef);

      setPlaybackQueue(prev => pruneSongsByValidIds(prev, validSongIds));
      if (queueRefChanged) queueContextRef.current = nextQueueRef;
      if (baseQueueRefChanged) baseQueueContextRef.current = nextBaseQueueRef;
      if (nativeQueueRefChanged) nativeQueueRef.current = nextNativeQueueRef;
      const syncedQueue = queueContextRef.current.slice();
      if (queueRefChanged) setPlaybackQueue(syncedQueue);
      setSongsState(songs);
      void storage.get<string>(StorageKeys.CURRENT_SONG_ID).then(currentSongId => {
        const normalizedCurrentSongId = currentSongId?.trim();
        if (normalizedCurrentSongId && !validSongIds.has(normalizedCurrentSongId)) {
          return storage.remove(StorageKeys.CURRENT_SONG_ID);
        }
        return undefined;
      }).catch(error => {
        console.warn('[LibraryRemove] Failed to clear current song id after removal.', error);
      });
      if (queueRefChanged || baseQueueRefChanged || nativeQueueRefChanged) {
        void syncNativeQueueToLibrary(nativeQueueRef, syncedQueue);
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
