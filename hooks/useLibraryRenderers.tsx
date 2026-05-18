import React, { useCallback } from 'react';
import LibraryAlbumTile from '../components/LibraryAlbumTile';
import LibraryFolderRow from '../components/LibraryFolderRow';
import LibraryGroupRow from '../components/LibraryGroupRow';
import LibraryPlaylistRow from '../components/LibraryPlaylistRow';
import SongCard from '../components/SongCard';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { displayAlbum, displayArtist, type LibraryGroupItem } from '../utils/libraryPresentation';
import type { LibraryPlaylistItem } from '../utils/libraryPlaylists';
import { isDemoSong } from '../utils/libraryDemoSongs';

const SONG_ROW_HEIGHT = 62;

export type LibraryRendererPlaySong = (song: Song, queue: Song[]) => unknown;
export type LibraryRendererPlayPlaylist = (playlistId: string) => unknown;
export type LibraryRendererRemoveFolder = (folder: ScanFolder) => void | Promise<void>;
export type LibraryRendererOpenTrackInfo = (song: Song) => void;

export interface UseLibraryRenderersOptions {
  currentSongId: string | null;
  filteredSongs: Song[];
  isPlaying: boolean;
  onOpenTrackInfo: LibraryRendererOpenTrackInfo;
  playPlaylist: LibraryRendererPlayPlaylist;
  playSong: LibraryRendererPlaySong;
  removeFolder: LibraryRendererRemoveFolder;
}

export interface UseLibraryRenderersResult {
  getSongItemLayout: (_: ArrayLike<Song> | null | undefined, index: number) => { length: number; offset: number; index: number };
  handleSongPress: (song: Song, queue?: Song[]) => void;
  renderAlbumTile: ({ item }: { item: LibraryGroupItem }) => React.ReactElement;
  renderFolderItem: ({ item }: { item: ScanFolder }) => React.ReactElement;
  renderGroupItem: ({ item }: { item: LibraryGroupItem }) => React.ReactElement;
  renderPlaylistItem: ({ item }: { item: LibraryPlaylistItem }) => React.ReactElement;
  renderSongItem: ({ item }: { item: Song }) => React.ReactElement;
  songKeyExtractor: (item: Song) => string;
}

export const useLibraryRenderers = ({
  currentSongId,
  filteredSongs,
  isPlaying,
  onOpenTrackInfo,
  playPlaylist,
  playSong,
  removeFolder,
}: UseLibraryRenderersOptions): UseLibraryRenderersResult => {
  const handleSongPress = useCallback((song: Song, queue: Song[] = filteredSongs) => {
    void playSong(song, queue);
  }, [filteredSongs, playSong]);

  const songKeyExtractor = useCallback((item: Song) => item.id, []);

  const getSongItemLayout = useCallback((_: ArrayLike<Song> | null | undefined, index: number) => ({
    length: SONG_ROW_HEIGHT,
    offset: SONG_ROW_HEIGHT * index,
    index,
  }), []);

  const renderSongItem = useCallback(({ item }: { item: Song }) => (
    <SongCard
      song={{ ...item, artist: displayArtist(item), album: displayAlbum(item) }}
      isCurrent={currentSongId === item.id}
      isPlaying={currentSongId === item.id && isPlaying}
      onPressSong={song => handleSongPress(song, filteredSongs)}
      onInfoSong={isDemoSong(item) ? undefined : onOpenTrackInfo}
    />
  ), [currentSongId, filteredSongs, handleSongPress, isPlaying, onOpenTrackInfo]);

  const renderGroupItem = useCallback(({ item }: { item: LibraryGroupItem }) => (
    <LibraryGroupRow group={item} onPress={group => group.songs[0] && handleSongPress(group.songs[0], group.songs)} />
  ), [handleSongPress]);

  const renderAlbumTile = useCallback(({ item }: { item: LibraryGroupItem }) => (
    <LibraryAlbumTile album={item} onPress={album => album.songs[0] && handleSongPress(album.songs[0], album.songs)} />
  ), [handleSongPress]);

  const renderPlaylistItem = useCallback(({ item }: { item: LibraryPlaylistItem }) => (
    <LibraryPlaylistRow playlist={item} onPlay={playlistId => void playPlaylist(playlistId)} />
  ), [playPlaylist]);

  const renderFolderItem = useCallback(({ item }: { item: ScanFolder }) => (
    <LibraryFolderRow folder={item} onRemove={removeFolder} />
  ), [removeFolder]);

  return {
    getSongItemLayout,
    handleSongPress,
    renderAlbumTile,
    renderFolderItem,
    renderGroupItem,
    renderPlaylistItem,
    renderSongItem,
    songKeyExtractor,
  };
};
