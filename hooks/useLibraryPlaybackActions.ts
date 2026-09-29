import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { LibraryAlbumViewMode } from '../types/LibraryView';
import type { Song } from '../types/Song';
import { shuffleItems } from '../utils/libraryShuffle';
import { runPlaybackUiAction } from '../utils/playbackUiActions';
import { getPreparedSongs } from '../utils/songPreparation';

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
    const prepared = getPreparedSongs(songsForActiveList);
    if (prepared.length === 0) return;
    const shuffled = shuffleItems(prepared);
    void runPlaybackUiAction('library-shuffle-play', () => playSong(shuffled[0], shuffled), { dropIfPending: true });
  }, [playSong, songsForActiveList]);

  const handlePlayActiveList = useCallback(() => {
    const prepared = getPreparedSongs(songsForActiveList);
    if (prepared[0]) handleSongPress(prepared[0], prepared);
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
