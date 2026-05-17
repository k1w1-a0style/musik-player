import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { LibraryAlbumViewMode } from '../components/LibraryAlbumViewToggle';
import type { Song } from '../types/Song';
import { shuffleItems } from '../utils/libraryShuffle';

type PlaySong = (song: Song, queue: Song[]) => unknown;
type HandleSongPress = (song: Song, queue: Song[]) => void;

interface UseLibraryPlaybackActionsOptions {
  handleSongPress: HandleSongPress;
  playSong: PlaySong;
  setAlbumViewMode: Dispatch<SetStateAction<LibraryAlbumViewMode>>;
  songsForActiveList: Song[];
}

export const useLibraryPlaybackActions = ({
  handleSongPress,
  playSong,
  setAlbumViewMode,
  songsForActiveList,
}: UseLibraryPlaybackActionsOptions) => {
  const handleShufflePress = useCallback(() => {
    if (songsForActiveList.length === 0) return;
    const shuffled = shuffleItems(songsForActiveList);
    void playSong(shuffled[0], shuffled);
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
