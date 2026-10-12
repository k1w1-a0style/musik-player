import type { MusicContextValue } from './musicContextTypes';

type ContextLibraryInput = Pick<
  MusicContextValue,
  'setSongs' | 'addSongs' | 'updateSongMetadata' | 'updateSongMetadataConfirmed' | 'applySongMetadataPatches'
>;

type ContextPlaylistInput = Pick<
  MusicContextValue,
  | 'createPlaylist'
  | 'saveQueueAsPlaylist'
  | 'deletePlaylist'
  | 'renamePlaylist'
  | 'addSongToPlaylist'
  | 'removeSongFromPlaylist'
  | 'moveSongInPlaylist'
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
  updateSongMetadata, updateSongMetadataConfirmed,
  applySongMetadataPatches,
  createPlaylist,
  saveQueueAsPlaylist,
  deletePlaylist,
  renamePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  moveSongInPlaylist,
  playPlaylist,
}: ContextActionsInput): ContextActionSections => ({
  library: {
    setSongs,
    addSongs,
    updateSongMetadata, ...(updateSongMetadataConfirmed ? { updateSongMetadataConfirmed } : {}),
    applySongMetadataPatches,
  },
  playlists: {
    createPlaylist,
    saveQueueAsPlaylist,
    deletePlaylist,
    renamePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    moveSongInPlaylist,
    playPlaylist,
  },
});
