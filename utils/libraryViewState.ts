import type { Playlist, Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { getLibraryDisplaySongs } from './libraryDemoSongs';
import { buildLibraryGroups } from './libraryPresentation';
import { buildLibraryPlaylistItems } from './libraryPlaylists';
import { filterFavoriteSongs, filterLibrarySongs } from './librarySongs';
import { countActiveScanFolders, getLibraryEmptyMessage, type LibraryTab } from './libraryTabs';
import { selectActiveLibrarySongs } from './librarySourceOwnership';

interface LibraryViewStateOptions {
  activeTab: LibraryTab;
  favoriteIds: string[];
  isDev: boolean;
  isReady: boolean;
  nodeEnv: string | undefined;
  playlists: Playlist[];
  query: string;
  scanFolders: ScanFolder[];
  songs: Song[];
  includeDeviceMusic?: boolean;
}

export const buildLibraryViewState = ({
  activeTab,
  favoriteIds,
  isDev,
  isReady,
  nodeEnv,
  playlists,
  query,
  scanFolders,
  songs,
  includeDeviceMusic,
}: LibraryViewStateOptions) => {
  const displayedSongs = selectActiveLibrarySongs(getLibraryDisplaySongs(songs, isReady, isDev, nodeEnv), scanFolders, includeDeviceMusic);
  const filteredSongs = filterLibrarySongs(displayedSongs, query);
  const { albumGroups, artistGroups, genreGroups } = buildLibraryGroups(filteredSongs);
  const favoriteSongs = filterFavoriteSongs(filteredSongs, favoriteIds);
  const songsForActiveList = activeTab === 'favorites' ? favoriteSongs : filteredSongs;

  return {
    activeFolders: countActiveScanFolders(scanFolders),
    albumGroups,
    artistGroups,
    displayedSongs,
    emptyMessage: getLibraryEmptyMessage(activeTab),
    favoriteSongs,
    filteredSongs,
    genreGroups,
    playlistItems: buildLibraryPlaylistItems(playlists, displayedSongs, query),
    songsForActiveList,
  };
};

export type LibraryViewState = ReturnType<typeof buildLibraryViewState>;
