import { useLibraryGroupRenderers } from './useLibraryGroupRenderers';
import { useLibraryPlaylistFolderRenderers } from './useLibraryPlaylistFolderRenderers';
import { useLibrarySongRenderer } from './useLibrarySongRenderer';
import type { UseLibraryRenderersOptions, UseLibraryRenderersResult } from './libraryRendererTypes';

export type {
  LibraryRendererOpenPlaylistDetail,
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
  onOpenPlaylistDetail,
  onOpenTrackInfo,
  playPlaylist,
  playSong,
  removeFolder,
  songViewMode,
}: UseLibraryRenderersOptions): UseLibraryRenderersResult => {
  const songRenderers = useLibrarySongRenderer({
    currentSongId,
    filteredSongs,
    isPlaying,
    onOpenTrackInfo,
    playSong,
    songViewMode,
  });

  const groupRenderers = useLibraryGroupRenderers({
    handleSongPress: songRenderers.handleSongPress,
  });

  const playlistFolderRenderers = useLibraryPlaylistFolderRenderers({
    onOpenPlaylistDetail,
    playPlaylist,
    removeFolder,
  });

  return {
    ...songRenderers,
    ...groupRenderers,
    ...playlistFolderRenderers,
  };
};
