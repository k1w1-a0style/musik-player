import type { MusicContextValue } from './musicContextTypes';

type ContextLibraryInput = Pick<
  MusicContextValue,
  'setSongs' | 'addSongs' | 'updateSongMetadata'
>;

type ContextPlaylistInput = Pick<
  MusicContextValue,
  | 'createPlaylist'
  | 'saveQueueAsPlaylist'
  | 'deletePlaylist'
  | 'renamePlaylist'
  | 'addSongToPlaylist'
  | 'removeSongFromPlaylist'
  | 'playPlaylist'
>;

type LibraryActionsInput = ContextLibraryInput;
type PlaylistActionsInput = ContextPlaylistInput;

export const buildMusicProviderContextLibraryInput = ({
  setSongs,
  addSongs,
  updateSongMetadata,
}: LibraryActionsInput): ContextLibraryInput => ({
  setSongs,
  addSongs,
  updateSongMetadata,
});

export const buildMusicProviderContextPlaylistInput = ({
  createPlaylist,
  saveQueueAsPlaylist,
  deletePlaylist,
  renamePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  playPlaylist,
}: PlaylistActionsInput): ContextPlaylistInput => ({
  createPlaylist,
  saveQueueAsPlaylist,
  deletePlaylist,
  renamePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  playPlaylist,
});
