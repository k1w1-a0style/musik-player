import type { Playlist, Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { getLibraryDisplaySongs } from './libraryDemoSongs';
import { groupSongs } from './libraryPresentation';
import { buildLibraryPlaylistItems } from './libraryPlaylists';
import { filterFavoriteSongs, filterLibrarySongs } from './librarySongs';
import { countActiveScanFolders, getLibraryEmptyMessage, type LibraryTab } from './libraryTabs';

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
}: LibraryViewStateOptions) => {
  const displayedSongs = getLibraryDisplaySongs(songs, isReady, isDev, nodeEnv);
  const filteredSongs = filterLibrarySongs(displayedSongs, query);
  const favoriteSongs = filterFavoriteSongs(filteredSongs, favoriteIds);
  const songsForActiveList = activeTab === 'favorites' ? favoriteSongs : filteredSongs;

  return {
    activeFolders: countActiveScanFolders(scanFolders),
    albumGroups: groupSongs(filteredSongs, 'album'),
    artistGroups: groupSongs(filteredSongs, 'artist'),
    displayedSongs,
    emptyMessage: getLibraryEmptyMessage(activeTab),
    favoriteSongs,
    filteredSongs,
    genreGroups: groupSongs(filteredSongs, 'genre'),
    playlistItems: buildLibraryPlaylistItems(playlists, displayedSongs, query),
    songsForActiveList,
  };
};
