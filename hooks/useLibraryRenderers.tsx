import { useLibraryGroupRenderers } from './useLibraryGroupRenderers';
import { useLibraryPlaylistFolderRenderers } from './useLibraryPlaylistFolderRenderers';
import { useLibrarySongRenderer } from './useLibrarySongRenderer';
import type { UseLibraryRenderersOptions, UseLibraryRenderersResult } from './libraryRendererTypes';

export type {
  LibraryRendererOpenTrackInfo,
  LibraryRendererPlayPlaylist,
  LibraryRendererPlaySong,
  LibraryRendererRemoveFolder,
  UseLibraryRenderersOptions,
  UseLibraryRenderersResult,
} from './libraryRendererTypes';

export const useLibraryRenderers = ({
  currentSongId,
  filteredSongs,
  isPlaying,
  onOpenTrackInfo,
  playPlaylist,
  playSong,
  removeFolder,
}: UseLibraryRenderersOptions): UseLibraryRenderersResult => {
  const songRenderers = useLibrarySongRenderer({
    currentSongId,
    filteredSongs,
    isPlaying,
    onOpenTrackInfo,
    playSong,
  });

  const groupRenderers = useLibraryGroupRenderers({
    handleSongPress: songRenderers.handleSongPress,
  });

  const playlistFolderRenderers = useLibraryPlaylistFolderRenderers({
    playPlaylist,
    removeFolder,
  });

  return {
    ...songRenderers,
    ...groupRenderers,
    ...playlistFolderRenderers,
  };
};
