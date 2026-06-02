import type React from 'react';
import { useCallback } from 'react';
import LibraryAlbumTile from '../components/LibraryAlbumTile';
import LibraryGroupRow from '../components/LibraryGroupRow';
import type { LibraryGroupItem } from '../utils/libraryPresentation';
import type { LibraryRendererHandleSongPress } from './libraryRendererTypes';

interface UseLibraryGroupRenderersOptions {
  handleSongPress: LibraryRendererHandleSongPress;
}

interface UseLibraryGroupRenderersResult {
  renderAlbumTile: ({ item }: { item: LibraryGroupItem }) => React.ReactElement;
  renderGroupItem: ({ item }: { item: LibraryGroupItem }) => React.ReactElement;
}

export const useLibraryGroupRenderers = ({
  handleSongPress,
}: UseLibraryGroupRenderersOptions): UseLibraryGroupRenderersResult => {
  const renderGroupItem = useCallback(({ item }: { item: LibraryGroupItem }) => (
    <LibraryGroupRow group={item} onPress={group => group.songs[0] && handleSongPress(group.songs[0], group.songs)} />
  ), [handleSongPress]);

  const renderAlbumTile = useCallback(({ item }: { item: LibraryGroupItem }) => (
    <LibraryAlbumTile album={item} onPress={album => album.songs[0] && handleSongPress(album.songs[0], album.songs)} />
  ), [handleSongPress]);

  return {
    renderAlbumTile,
    renderGroupItem,
  };
};
