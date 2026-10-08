import type React from 'react';
import { useCallback, useMemo, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
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
import { runPlaybackUiAction } from '../utils/playbackUiActions';

interface UseLibrarySongRendererOptions {
  currentSongId: string | null;
  filteredSongs: Song[];
  isPlaying: boolean;
  onOpenTrackInfo: LibraryRendererOpenTrackInfo;
  onOpenSongActions?: (song: Song) => void;
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
  onOpenSongActions,
  playSong,
  songViewMode = DEFAULT_LIBRARY_SONG_VIEW_MODE,
}: UseLibrarySongRendererOptions): UseLibrarySongRendererResult => {
  // Keep the latest filteredSongs / playSong / onOpenTrackInfo in refs so the
  // row-level callbacks passed into <SongCard/> remain reference-stable across
  // renders. Without this every filter/search/favorite tick would rebuild the
  // press handlers and defeat SongCard's React.memo, causing every visible row
  // to re-render even when only playback progress or currentSongId changed.
  const { fontScale } = useWindowDimensions();
  const songsById = useMemo(() => new Map(filteredSongs.map(song => [getLibrarySongKey(song), song])), [filteredSongs]);
  const songsByIdRef = useRef(songsById);
  songsByIdRef.current = songsById;
  const infoActionRef = useRef(onOpenSongActions ?? onOpenTrackInfo);
  infoActionRef.current = onOpenSongActions ?? onOpenTrackInfo;
  const resolveSong = useCallback((song: Song) => songsByIdRef.current.get(getLibrarySongKey(song)) ?? song, []);
  const handleInfoPress = useCallback((song: Song) => { infoActionRef.current(resolveSong(song)); }, [resolveSong]);
  const filteredSongsRef = useRef(filteredSongs);
  filteredSongsRef.current = filteredSongs;
  const playSongRef = useRef(playSong);
  playSongRef.current = playSong;

  const handleSongPress = useCallback<LibraryRendererHandleSongPress>((song, queue) => {
    // Reading refs at press-time avoids stale closures when the filtered list
    // changes between the row render and the actual tap (e.g. active search).
    void runPlaybackUiAction(
      `library-play-song-${song.id}`,
      () => playSongRef.current(resolveSong(song), queue ?? filteredSongsRef.current),
      { dropIfPending: false },
    );
  }, [resolveSong]);

  const songKeyExtractor = useCallback(getLibrarySongKey, []);

  const getSongItemLayout = useCallback((data: ArrayLike<Song> | null | undefined, index: number) =>
    getLibrarySongItemLayout(data, index, fontScale), [fontScale]);

  const variant = getLibrarySongCardVariant(songViewMode);

  // Only currentSongId / isPlaying / variant force renderSongItem to change,
  // which is exactly the surface SongCard's memo compares on.
  const renderSongItem = useCallback(({ item }: { item: Song }) => (
    <SongCard
      song={buildSongCardSong(item)}
      isCurrent={currentSongId === item.id}
      isPlaying={currentSongId === item.id && isPlaying}
      variant={variant}
      onPressSong={handleSongPress}
      onInfoSong={shouldShowTrackInfoAction(item) ? handleInfoPress : undefined}
    />
  ), [currentSongId, handleInfoPress, handleSongPress, isPlaying, variant]);

  return {
    getSongItemLayout,
    handleSongPress,
    renderSongItem,
    songKeyExtractor,
  };
};
