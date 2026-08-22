import { useMemo } from 'react';
import type { Playlist, Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryViewState } from '../utils/libraryViewState';
import { getLibraryDisplaySongs } from '../utils/libraryDemoSongs';
import { groupSongs, type LibraryGroupItem } from '../utils/libraryPresentation';
import { buildLibraryPlaylistItems, type LibraryPlaylistItem } from '../utils/libraryPlaylists';
import { filterFavoriteSongs, filterLibrarySongs } from '../utils/librarySongs';
import { countActiveScanFolders, getLibraryEmptyMessage } from '../utils/libraryTabs';
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

export type UseLibraryViewStateResult = LibraryViewState;

const NO_GROUPS: LibraryGroupItem[] = [];
const NO_PLAYLISTS: LibraryPlaylistItem[] = [];
const NO_SONGS: Song[] = [];

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
}: UseLibraryViewStateOptions): UseLibraryViewStateResult => {
  const displayedSongs = useMemo(
    () => getLibraryDisplaySongs(songs, isReady, isDev, nodeEnv),
    [isDev, isReady, nodeEnv, songs],
  );
  const filteredSongs = useMemo(
    () => filterLibrarySongs(displayedSongs, query),
    [displayedSongs, query],
  );
  const albumGroups = useMemo(
    () => activeTab === 'albums' ? groupSongs(filteredSongs, 'album') : NO_GROUPS,
    [activeTab, filteredSongs],
  );
  const artistGroups = useMemo(
    () => activeTab === 'artists' ? groupSongs(filteredSongs, 'artist') : NO_GROUPS,
    [activeTab, filteredSongs],
  );
  const genreGroups = useMemo(
    () => activeTab === 'genres' ? groupSongs(filteredSongs, 'genre') : NO_GROUPS,
    [activeTab, filteredSongs],
  );
  const favoriteSongs = useMemo(
    () => activeTab === 'favorites' ? filterFavoriteSongs(filteredSongs, favoriteIds) : NO_SONGS,
    [activeTab, favoriteIds, filteredSongs],
  );
  const playlistItems = useMemo(
    () => activeTab === 'playlists' ? buildLibraryPlaylistItems(playlists, displayedSongs, query) : NO_PLAYLISTS,
    [activeTab, displayedSongs, playlists, query],
  );
  const activeFolders = useMemo(() => countActiveScanFolders(scanFolders), [scanFolders]);

  return useMemo(() => ({
    activeFolders,
    albumGroups,
    artistGroups,
    displayedSongs,
    emptyMessage: getLibraryEmptyMessage(activeTab),
    favoriteSongs,
    filteredSongs,
    genreGroups,
    playlistItems,
    songsForActiveList: activeTab === 'favorites' ? favoriteSongs : filteredSongs,
  }), [activeFolders, activeTab, albumGroups, artistGroups, displayedSongs, favoriteSongs, filteredSongs, genreGroups, playlistItems]);
};
