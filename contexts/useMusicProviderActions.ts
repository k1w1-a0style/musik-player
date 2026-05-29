import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Playlist, Song } from '../types/Song';
import { useLibraryActions } from './useLibraryActions';
import { usePlaybackQueueActions } from './usePlaybackQueueActions';
import { usePlaylistActions } from './usePlaylistActions';

export interface MusicProviderActionsArgs {
  songsRef: MutableRefObject<Song[]>;
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  nativeQueueRef: MutableRefObject<Song[]>;
  setSongsState: Dispatch<SetStateAction<Song[]>>;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  setPlaybackQueue: Dispatch<SetStateAction<Song[]>>;
  playlists: Playlist[];
  setPlaylists: Dispatch<SetStateAction<Playlist[]>>;
  currentSongId?: string;
  shuffle: boolean;
  setShuffle: Dispatch<SetStateAction<boolean>>;
}

export const useMusicProviderActions = ({
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  setSongsState,
  setCurrentSong,
  setPlaybackQueue,
  playlists,
  setPlaylists,
  currentSongId,
  shuffle,
  setShuffle,
}: MusicProviderActionsArgs) => {
  const { playSong, toggleShuffle } = usePlaybackQueueActions({
    songsRef,
    queueContextRef,
    baseQueueContextRef,
    nativeQueueRef,
    setPlaybackQueue,
    setCurrentSong,
    currentSongId,
    shuffle,
    setShuffle,
  });

  const { setSongs, addSongs, updateSongMetadata } = useLibraryActions({
    queueContextRef,
    baseQueueContextRef,
    nativeQueueRef,
    setSongsState,
    setCurrentSong,
    setPlaybackQueue,
    setPlaylists,
  });

  const {
    createPlaylist,
    saveQueueAsPlaylist,
    deletePlaylist,
    renamePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    playPlaylist,
  } = usePlaylistActions({
    playlists,
    setPlaylists,
    songsRef,
    playSong,
  });

  return {
    playSong,
    toggleShuffle,
    setSongs,
    addSongs,
    updateSongMetadata,
    createPlaylist,
    saveQueueAsPlaylist,
    deletePlaylist,
    renamePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    playPlaylist,
  };
};
