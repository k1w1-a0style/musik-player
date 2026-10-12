import { useMemo } from 'react';
import type { LibrarySelectionScope } from '../contexts/LibrarySelectionContext';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryPlaylistItem } from '../utils/libraryPlaylists';
import type { LibraryTab } from '../utils/libraryTabs';
import { resolveCleanerFolderSelection } from '../utils/tagCleanerSelection';

interface SelectionScopeOptions {
  songs: Song[];
  songsForActiveList: Song[];
  playlistItems: LibraryPlaylistItem[];
  scanFolders: ScanFolder[];
  activeTab: LibraryTab;
  onOpenCleaner: (songIds: string[]) => void;
}
const visibleSelectionSongs = (options: SelectionScopeOptions): Song[] => {
  if (options.activeTab === 'playlists') return options.playlistItems.flatMap(playlist => playlist.songs);
  if (options.activeTab !== 'folders') return options.songsForActiveList;
  const ids = new Set(resolveCleanerFolderSelection(options.songs, options.scanFolders, true).songIds);
  return options.songs.filter(song => ids.has(song.id));
};
export const useLibrarySelectionScope = (options: SelectionScopeOptions): LibrarySelectionScope => {
  const { songs, songsForActiveList, playlistItems, scanFolders, activeTab, onOpenCleaner } = options;
  const visibleSongs = useMemo(() => visibleSelectionSongs({ songs, songsForActiveList, playlistItems, scanFolders, activeTab, onOpenCleaner }),
    [songs, songsForActiveList, playlistItems, scanFolders, activeTab, onOpenCleaner]);
  return useMemo(() => ({ songs, visibleSongs, onOpenCleaner }), [songs, visibleSongs, onOpenCleaner]);
};
