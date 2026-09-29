import type React from 'react';
import { useCallback } from 'react';
import { getPreparedSongs } from '../utils/songPreparation';
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
    <LibraryGroupRow group={item} onPress={group => {
      const prepared = getPreparedSongs(group.songs);
      if (prepared[0]) handleSongPress(prepared[0], prepared);
    }} />
  ), [handleSongPress]);

  const renderAlbumTile = useCallback(({ item }: { item: LibraryGroupItem }) => (
    <LibraryAlbumTile album={item} onPress={album => {
      const prepared = getPreparedSongs(album.songs);
      if (prepared[0]) handleSongPress(prepared[0], prepared);
    }} />
  ), [handleSongPress]);

  return {
    renderAlbumTile,
    renderGroupItem,
  };
};
