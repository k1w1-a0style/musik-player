import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { Playlist, Song } from '../types/Song';
import { prunePlaylists } from '../utils/playlistState';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';

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

export const mergeUniqueSongs = (currentSongs: Song[], newSongs: Song[]): Song[] => {
  const existing = new Set(currentSongs.map(song => song.id));
  return [...currentSongs, ...newSongs.filter(song => !existing.has(song.id))];
};

export const patchSongById = (songId: string, patch: Partial<Song>) => (song: Song): Song =>
  song.id === songId ? { ...song, ...patch } : song;

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
      setSongsState(songs);
    },
    [setPlaylists, setSongsState],
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
      setCurrentSong(prev => (prev?.id === songId ? { ...prev, ...patch } : prev));
      setPlaybackQueue(prev => prev.map(patchSong));
      queueContextRef.current = queueContextRef.current.map(patchSong);
      baseQueueContextRef.current = baseQueueContextRef.current.map(patchSong);
      nativeQueueRef.current = nativeQueueRef.current.map(patchSong);

      const queueIndex = nativeQueueRef.current.findIndex(song => song.id === songId);
      const queuedPatchedSong =
        (queueIndex >= 0 ? nativeQueueRef.current[queueIndex] : undefined) ??
        baseQueueContextRef.current.find(song => song.id === songId);
      if (!queuedPatchedSong || queueIndex < 0) return;

      void TrackPlayer.updateMetadataForTrack(queueIndex, toTrackPlayerTrack(queuedPatchedSong)).catch(
        () => undefined,
      );
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
