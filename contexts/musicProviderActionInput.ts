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

type ContextActionsInput = ContextLibraryInput & ContextPlaylistInput;

interface ContextActionSections {
  library: ContextLibraryInput;
  playlists: ContextPlaylistInput;
}

export const buildMusicProviderContextActionsInput = ({
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
}: ContextActionsInput): ContextActionSections => ({
  library: {
    setSongs,
    addSongs,
    updateSongMetadata,
  },
  playlists: {
    createPlaylist,
    saveQueueAsPlaylist,
    deletePlaylist,
    renamePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    playPlaylist,
  },
});
