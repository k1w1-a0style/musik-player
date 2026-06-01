import type { Playlist, Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryTab } from '../utils/libraryTabs';
import { useLibraryViewState, type UseLibraryViewStateResult } from './useLibraryViewState';

export interface UseLibraryControllerViewModelOptions {
  activeTab: LibraryTab;
  favoriteIds: string[];
  isReady: boolean;
  playlists: Playlist[];
  query: string;
  scanFolders: ScanFolder[];
  songs: Song[];
}

export type UseLibraryControllerViewModelResult = UseLibraryViewStateResult;

export const useLibraryControllerViewModel = ({
  activeTab,
  favoriteIds,
  isReady,
  playlists,
  query,
  scanFolders,
  songs,
}: UseLibraryControllerViewModelOptions): UseLibraryControllerViewModelResult => useLibraryViewState({
  activeTab,
  favoriteIds,
  isReady,
  playlists,
  query,
  scanFolders,
  songs,
});
