import type React from 'react';
import { useCallback } from 'react';
import LibraryFolderRow from '../components/LibraryFolderRow';
import LibraryPlaylistRow from '../components/LibraryPlaylistRow';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryPlaylistItem } from '../utils/libraryPlaylists';
import type {
  LibraryRendererOpenPlaylistDetail,
  LibraryRendererPlayPlaylist,
  LibraryRendererRemoveFolder,
} from './libraryRendererTypes';

interface UseLibraryPlaylistFolderRenderersOptions {
  onOpenPlaylistDetail?: LibraryRendererOpenPlaylistDetail;
  playPlaylist: LibraryRendererPlayPlaylist;
  removeFolder: LibraryRendererRemoveFolder;
}

interface UseLibraryPlaylistFolderRenderersResult {
  renderFolderItem: ({ item }: { item: ScanFolder }) => React.ReactElement;
  renderPlaylistItem: ({ item }: { item: LibraryPlaylistItem }) => React.ReactElement;
}

export const useLibraryPlaylistFolderRenderers = ({
  onOpenPlaylistDetail,
  playPlaylist,
  removeFolder,
}: UseLibraryPlaylistFolderRenderersOptions): UseLibraryPlaylistFolderRenderersResult => {
  const renderPlaylistItem = useCallback(({ item }: { item: LibraryPlaylistItem }) => (
    <LibraryPlaylistRow
      playlist={item}
      onOpen={playlistId => void onOpenPlaylistDetail?.(playlistId)}
      onPlay={playlistId => void playPlaylist(playlistId)}
    />
  ), [onOpenPlaylistDetail, playPlaylist]);

  const renderFolderItem = useCallback(({ item }: { item: ScanFolder }) => (
    <LibraryFolderRow folder={item} onRemove={removeFolder} />
  ), [removeFolder]);

  return {
    renderFolderItem,
    renderPlaylistItem,
  };
};
