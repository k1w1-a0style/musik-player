import { useMemo } from 'react';
import type { Playlist, Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { buildLibraryViewState } from '../utils/libraryViewState';
import type { LibraryTab } from '../utils/libraryTabs';

declare const __DEV__: boolean;

const NODE_ENV = process.env.NODE_ENV;

export interface UseLibraryViewStateOptions {
  activeTab: LibraryTab;
  favoriteIds: string[];
  isDev?: boolean;
  isReady: boolean;
  nodeEnv?: string;
  playlists: Playlist[];
  query: string;
  scanFolders: ScanFolder[];
  songs: Song[];
}

export type UseLibraryViewStateResult = ReturnType<typeof buildLibraryViewState>;

export const useLibraryViewState = ({
  activeTab,
  favoriteIds,
  isDev = __DEV__,
  isReady,
  nodeEnv = NODE_ENV,
  playlists,
  query,
  scanFolders,
  songs,
}: UseLibraryViewStateOptions): UseLibraryViewStateResult => useMemo(() => buildLibraryViewState({
  activeTab,
  favoriteIds,
  isDev,
  isReady,
  nodeEnv,
  playlists,
  query,
  scanFolders,
  songs,
}), [activeTab, favoriteIds, isDev, isReady, nodeEnv, playlists, query, scanFolders, songs]);
