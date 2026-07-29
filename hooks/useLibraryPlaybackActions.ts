import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { LibraryAlbumViewMode } from '../components/LibraryAlbumViewToggle';
import type { Song } from '../types/Song';
import { shuffleItems } from '../utils/libraryShuffle';
import { runPlaybackUiAction } from '../utils/playbackUiActions';

export type PlaySong = (song: Song, queue: Song[]) => unknown;
export type HandleSongPress = (song: Song, queue: Song[]) => void;

export interface UseLibraryPlaybackActionsOptions {
  handleSongPress: HandleSongPress;
  playSong: PlaySong;
  setAlbumViewMode: Dispatch<SetStateAction<LibraryAlbumViewMode>>;
  songsForActiveList: Song[];
}

export interface UseLibraryPlaybackActionsResult {
  handlePlayActiveList: () => void;
  handleShufflePress: () => void;
  toggleAlbumView: () => void;
}

export const useLibraryPlaybackActions = ({
  handleSongPress,
  playSong,
  setAlbumViewMode,
  songsForActiveList,
}: UseLibraryPlaybackActionsOptions): UseLibraryPlaybackActionsResult => {
  const handleShufflePress = useCallback(() => {
    if (songsForActiveList.length === 0) return;
    const shuffled = shuffleItems(songsForActiveList);
    void runPlaybackUiAction('library-shuffle-play', () => playSong(shuffled[0], shuffled), { dropIfPending: true });
  }, [playSong, songsForActiveList]);

  const handlePlayActiveList = useCallback(() => {
    if (songsForActiveList[0]) handleSongPress(songsForActiveList[0], songsForActiveList);
  }, [handleSongPress, songsForActiveList]);

  const toggleAlbumView = useCallback(() => {
    setAlbumViewMode(mode => mode === 'grid' ? 'list' : 'grid');
  }, [setAlbumViewMode]);

  return {
    handlePlayActiveList,
    handleShufflePress,
    toggleAlbumView,
  };
};
