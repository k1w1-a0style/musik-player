import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Playlist, Song } from '../types/Song';
import {
  addSongToPlaylistById,
  deletePlaylistById,
  moveSongInPlaylistById,
  removeSongFromPlaylistById,
  renamePlaylistById,
} from '../utils/playlistState';
import type { PlaylistSongMoveDirection } from '../utils/playlistState';
import {
  appendPlaylist,
  createPlaylistRecord,
  createPlaylistRecordFromQueue,
  runPlayPlaylistAction,
} from './playlistActionHelpers';
export { buildPlaylistQueue } from './playlistActionHelpers';
export type { PlaylistSongMoveDirection } from '../utils/playlistState';

export interface PlaylistActionsArgs {
  playlists: Playlist[];
  setPlaylists: Dispatch<SetStateAction<Playlist[]>>;
  songsRef: MutableRefObject<Song[]>;
  playSong: (song: Song, queue?: Song[]) => Promise<void>;
}

export interface PlaylistActions {
  createPlaylist: (name: string) => Playlist;
  saveQueueAsPlaylist: (name: string, queue: Song[]) => Playlist | null;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  addSongToPlaylist: (playlistId: string, songId: string) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  moveSongInPlaylist: (playlistId: string, songId: string, direction: PlaylistSongMoveDirection) => void;
  playPlaylist: (playlistId: string) => Promise<void>;
}

export const usePlaylistActions = ({
  playlists,
  setPlaylists,
  songsRef,
  playSong,
}: PlaylistActionsArgs): PlaylistActions => {
  const pendingPlaylistsRef = useRef(playlists);
  if (pendingPlaylistsRef.current !== playlists) {
    pendingPlaylistsRef.current = playlists;
  }

  const createPlaylist = useCallback(
    (name: string) => {
      const playlist = createPlaylistRecord(name);
      setPlaylists(prev => appendPlaylist(prev, playlist));
      return playlist;
    },
    [setPlaylists],
  );

  const saveQueueAsPlaylist = useCallback(
    (name: string, queue: Song[]) => {
      const now = Date.now();
      const createdPlaylist = createPlaylistRecordFromQueue(name, queue, now, pendingPlaylistsRef.current);
      if (!createdPlaylist) return null;

      pendingPlaylistsRef.current = appendPlaylist(pendingPlaylistsRef.current, createdPlaylist);
      setPlaylists(prev => {
        const playlist = createPlaylistRecordFromQueue(name, queue, now, prev);
        if (!playlist) return prev;
        const playlistForPrev =
          playlist.name === createdPlaylist.name
            ? createdPlaylist
            : {
                ...createdPlaylist,
                name: playlist.name,
              };
        const nextPlaylists = appendPlaylist(prev, playlistForPrev);
        pendingPlaylistsRef.current = nextPlaylists;
        return nextPlaylists;
      });
      return createdPlaylist;
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

  const moveSongInPlaylist = useCallback(
    (playlistId: string, songId: string, direction: PlaylistSongMoveDirection) => {
      setPlaylists(prev => moveSongInPlaylistById(prev, playlistId, songId, direction));
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
    saveQueueAsPlaylist,
    deletePlaylist,
    renamePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    moveSongInPlaylist,
    playPlaylist,
  };
};
