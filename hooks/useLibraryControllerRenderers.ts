import type { Dispatch, SetStateAction } from 'react';
import type { LibraryAlbumViewMode } from '../components/LibraryAlbumViewToggle';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { useLibraryPlaybackActions } from './useLibraryPlaybackActions';
import { useLibraryRenderers, type UseLibraryRenderersResult } from './useLibraryRenderers';

export interface UseLibraryControllerRenderersOptions {
  currentSongId: string | null;
  filteredSongs: Song[];
  isPlaying: boolean;
  onOpenTrackInfo: (song: Song) => void;
  playPlaylist: (playlistId: string) => unknown;
  playSong: (song: Song, queue?: Song[]) => unknown;
  removeFolder: (folder: ScanFolder) => void | Promise<void>;
  setAlbumViewMode: Dispatch<SetStateAction<LibraryAlbumViewMode>>;
  songsForActiveList: Song[];
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
  onOpenTrackInfo,
  playPlaylist,
  playSong,
  removeFolder,
  setAlbumViewMode,
  songsForActiveList,
}: UseLibraryControllerRenderersOptions): UseLibraryControllerRenderersResult => {
  const renderers = useLibraryRenderers({
    currentSongId,
    filteredSongs,
    isPlaying,
    onOpenTrackInfo,
    playPlaylist,
    playSong,
    removeFolder,
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
