import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Playlist, Song } from '../types/Song';
import {
  addSongToPlaylistById,
  deletePlaylistById,
  removeSongFromPlaylistById,
  renamePlaylistById,
} from '../utils/playlistState';
import {
  appendPlaylist,
  createPlaylistRecord,
  runPlayPlaylistAction,
} from './playlistActionHelpers';
export { buildPlaylistQueue } from './playlistActionHelpers';

interface PlaylistActionsArgs {
  playlists: Playlist[];
  setPlaylists: Dispatch<SetStateAction<Playlist[]>>;
  songsRef: MutableRefObject<Song[]>;
  playSong: (song: Song, queue?: Song[]) => Promise<void>;
}

interface PlaylistActions {
  createPlaylist: (name: string) => Playlist;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  addSongToPlaylist: (playlistId: string, songId: string) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  playPlaylist: (playlistId: string) => Promise<void>;
}

export const usePlaylistActions = ({
  playlists,
  setPlaylists,
  songsRef,
  playSong,
}: PlaylistActionsArgs): PlaylistActions => {
  const createPlaylist = useCallback(
    (name: string) => {
      const playlist = createPlaylistRecord(name);
      setPlaylists(prev => appendPlaylist(prev, playlist));
      return playlist;
    },
    [setPlaylists],
  );

  const deletePlaylist = useCallback(
    (id: string) => {
      setPlaylists(prev => deletePlaylistById(prev, id));
    },
    [setPlaylists],
  );

  const renamePlaylist = useCallback(
    (id: string, name: string) => {
      setPlaylists(prev => renamePlaylistById(prev, id, name));
    },
    [setPlaylists],
  );

  const addSongToPlaylist = useCallback(
    (playlistId: string, songId: string) => {
      setPlaylists(prev => addSongToPlaylistById(prev, playlistId, songId));
    },
    [setPlaylists],
  );

  const removeSongFromPlaylist = useCallback(
    (playlistId: string, songId: string) => {
      setPlaylists(prev => removeSongFromPlaylistById(prev, playlistId, songId));
    },
    [setPlaylists],
  );

  const playPlaylist = useCallback(
    async (playlistId: string) => {
      await runPlayPlaylistAction({
        playlistId,
        playlists,
        songs: songsRef.current,
        playSong,
      });
    },
    [playSong, playlists, songsRef],
  );

  return {
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    playPlaylist,
  };
};
