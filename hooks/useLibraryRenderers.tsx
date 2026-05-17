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

type PlaySong = (song: Song, queue: Song[]) => unknown;
type PlayPlaylist = (playlistId: string) => unknown;
type RemoveFolder = (folder: ScanFolder) => unknown;
type OpenTrackInfo = (song: Song) => void;

interface UseLibraryRenderersOptions {
  currentSongId: string | null;
  filteredSongs: Song[];
  isPlaying: boolean;
  onOpenTrackInfo: OpenTrackInfo;
  playPlaylist: PlayPlaylist;
  playSong: PlaySong;
  removeFolder: RemoveFolder;
}

export const useLibraryRenderers = ({
  currentSongId,
  filteredSongs,
  isPlaying,
  onOpenTrackInfo,
  playPlaylist,
  playSong,
  removeFolder,
}: UseLibraryRenderersOptions) => {
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
