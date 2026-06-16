import type { Dispatch, SetStateAction } from 'react';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import type { Playlist, Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { useLibraryScreenState, type UseLibraryScreenStateResult } from './useLibraryScreenState';
import { useLibraryStoredState } from './useLibraryStoredState';

const defaultPlayPlaylist = async (): Promise<undefined> => undefined;
const defaultPlaylists: Playlist[] = [];

export interface LibraryControllerMusicState {
  currentSongId: string | null;
  isPlaying: boolean;
  isReady: boolean;
  playPlaylist: (playlistId: string) => unknown;
  playSong: (song: Song, queue?: Song[]) => unknown;
  playlists: Playlist[];
  setSongs: (songs: Song[]) => void;
  songs: Song[];
  updateSongMetadata: (songId: string, patch: Partial<Song>) => void;
  songsCount: number;
}

export interface LibraryControllerStoredState {
  favoriteIds: string[];
  scanFolders: ScanFolder[];
  setScanFolders: Dispatch<SetStateAction<ScanFolder[]>>;
}

export interface UseLibraryControllerStateResult {
  music: LibraryControllerMusicState;
  screen: UseLibraryScreenStateResult;
  stored: LibraryControllerStoredState;
}

export const useLibraryControllerState = (): UseLibraryControllerStateResult => {
  const {
    currentSong,
    isPlaying,
    isReady,
    playPlaylist = defaultPlayPlaylist,
    playSong,
    playlists = defaultPlaylists,
    setSongs,
    songs,
    updateSongMetadata,
  } = useLibraryMusicContext();
  const screen = useLibraryScreenState();
  const { favoriteIds, scanFolders, setScanFolders } = useLibraryStoredState(screen.activeTab);

  return {
    music: {
      currentSongId: currentSong?.id ?? null,
      isPlaying,
      isReady,
      playPlaylist,
      playSong,
      playlists,
      setSongs,
      songs,
      updateSongMetadata,
      songsCount: songs.length,
    },
    screen,
    stored: {
      favoriteIds,
      scanFolders,
      setScanFolders,
    },
  };
};
