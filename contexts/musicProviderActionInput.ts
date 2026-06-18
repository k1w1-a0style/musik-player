import type { MusicContextValue } from './musicContextTypes';

type ContextLibraryInput = Pick<
  MusicContextValue,
  'setSongs' | 'addSongs' | 'updateSongMetadata' | 'applySongMetadataPatches'
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
  applySongMetadataPatches,
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
    applySongMetadataPatches,
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
