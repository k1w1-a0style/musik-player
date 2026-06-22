import type React from 'react';
import { useCallback } from 'react';
import SongCard from '../components/SongCard';
import type { Song } from '../types/Song';
import {
  buildSongCardSong,
  getLibrarySongItemLayout,
  getLibrarySongKey,
  shouldShowTrackInfoAction,
} from '../utils/libraryRendererHelpers';
import {
  DEFAULT_LIBRARY_SONG_VIEW_MODE,
  getLibrarySongCardVariant,
  type LibrarySongViewMode,
} from '../utils/libraryViewMode';
import type {
  LibraryRendererHandleSongPress,
  LibraryRendererOpenTrackInfo,
  LibraryRendererPlaySong,
} from './libraryRendererTypes';

interface UseLibrarySongRendererOptions {
  currentSongId: string | null;
  filteredSongs: Song[];
  isPlaying: boolean;
  onOpenTrackInfo: LibraryRendererOpenTrackInfo;
  playSong: LibraryRendererPlaySong;
  songViewMode?: LibrarySongViewMode;
}

interface UseLibrarySongRendererResult {
  getSongItemLayout: (_: ArrayLike<Song> | null | undefined, index: number) => { length: number; offset: number; index: number };
  handleSongPress: LibraryRendererHandleSongPress;
  renderSongItem: ({ item }: { item: Song }) => React.ReactElement;
  songKeyExtractor: (item: Song) => string;
}

export const useLibrarySongRenderer = ({
  currentSongId,
  filteredSongs,
  isPlaying,
  onOpenTrackInfo,
  playSong,
  songViewMode = DEFAULT_LIBRARY_SONG_VIEW_MODE,
}: UseLibrarySongRendererOptions): UseLibrarySongRendererResult => {
  const handleSongPress = useCallback((song: Song, queue: Song[] = filteredSongs) => {
    void playSong(song, queue);
  }, [filteredSongs, playSong]);

  const songKeyExtractor = useCallback(getLibrarySongKey, []);

  const getSongItemLayout = useCallback(getLibrarySongItemLayout, []);

  const variant = getLibrarySongCardVariant(songViewMode);

  const renderSongItem = useCallback(({ item }: { item: Song }) => (
    <SongCard
      song={buildSongCardSong(item)}
      isCurrent={currentSongId === item.id}
      isPlaying={currentSongId === item.id && isPlaying}
      variant={variant}
      onPressSong={song => handleSongPress(song, filteredSongs)}
      onInfoSong={shouldShowTrackInfoAction(item) ? onOpenTrackInfo : undefined}
    />
  ), [currentSongId, filteredSongs, handleSongPress, isPlaying, onOpenTrackInfo, variant]);

  return {
    getSongItemLayout,
    handleSongPress,
    renderSongItem,
    songKeyExtractor,
  };
};
