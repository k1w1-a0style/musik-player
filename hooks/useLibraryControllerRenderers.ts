import type { Dispatch, SetStateAction } from 'react';
import type { LibraryAlbumViewMode } from '../types/LibraryView';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibrarySongViewMode } from '../utils/libraryViewMode';
import { useLibraryPlaybackActions } from './useLibraryPlaybackActions';
import { useLibraryRenderers, type UseLibraryRenderersResult } from './useLibraryRenderers';

export interface UseLibraryControllerRenderersOptions {
  currentSongId: string | null;
  filteredSongs: Song[];
  isPlaying: boolean;
  onOpenPlaylistDetail: (playlistId: string) => void;
  onOpenTrackInfo: (song: Song) => void;
  onOpenSongActions?: (song: Song) => void;
  playPlaylist: (playlistId: string) => unknown;
  playSong: (song: Song, queue?: Song[]) => unknown;
  removeFolder: (folder: ScanFolder) => void | Promise<void>;
  setAlbumViewMode: Dispatch<SetStateAction<LibraryAlbumViewMode>>;
  songsForActiveList: Song[];
  songViewMode?: LibrarySongViewMode;
}

export interface UseLibraryControllerRenderersResult extends UseLibraryRenderersResult {
  handlePlayActiveList: () => void;
  handleShufflePress: () => void;
  toggleAlbumView: () => void;
}

export const useLibraryControllerRenderers = ({
  currentSongId,
  filteredSongs,
  isPlaying,
  onOpenPlaylistDetail,
  onOpenTrackInfo,
  onOpenSongActions,
  playPlaylist,
  playSong,
  removeFolder,
  setAlbumViewMode,
  songsForActiveList,
  songViewMode,
}: UseLibraryControllerRenderersOptions): UseLibraryControllerRenderersResult => {
  const renderers = useLibraryRenderers({
    currentSongId,
    filteredSongs,
    isPlaying,
    onOpenPlaylistDetail,
    onOpenTrackInfo,
    onOpenSongActions,
    playPlaylist,
    playSong,
    removeFolder,
    songViewMode,
  });

  const playbackActions = useLibraryPlaybackActions({
    handleSongPress: renderers.handleSongPress,
    playSong,
    setAlbumViewMode,
    songsForActiveList,
  });

  return {
    ...renderers,
    ...playbackActions,
  };
};
