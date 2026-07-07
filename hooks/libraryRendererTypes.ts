import type React from 'react';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryGroupItem } from '../utils/libraryPresentation';
import type { LibraryPlaylistItem } from '../utils/libraryPlaylists';
import type { LibrarySongViewMode } from '../utils/libraryViewMode';

export type LibraryRendererPlaySong = (song: Song, queue: Song[]) => unknown;
export type LibraryRendererPlayPlaylist = (playlistId: string) => unknown;
export type LibraryRendererOpenPlaylistDetail = (playlistId: string) => unknown;
export type LibraryRendererRemoveFolder = (folder: ScanFolder) => void | Promise<void>;
export type LibraryRendererOpenTrackInfo = (song: Song) => void;
export type LibraryRendererHandleSongPress = (song: Song, queue?: Song[]) => void;

export interface UseLibraryRenderersOptions {
  currentSongId: string | null;
  filteredSongs: Song[];
  isPlaying: boolean;
  onOpenPlaylistDetail?: LibraryRendererOpenPlaylistDetail;
  onOpenTrackInfo: LibraryRendererOpenTrackInfo;
  playPlaylist: LibraryRendererPlayPlaylist;
  playSong: LibraryRendererPlaySong;
  removeFolder: LibraryRendererRemoveFolder;
  songViewMode?: LibrarySongViewMode;
}

export interface UseLibraryRenderersResult {
  getSongItemLayout: (_: ArrayLike<Song> | null | undefined, index: number) => { length: number; offset: number; index: number };
  handleSongPress: LibraryRendererHandleSongPress;
  renderAlbumTile: ({ item }: { item: LibraryGroupItem }) => React.ReactElement;
  renderFolderItem: ({ item }: { item: ScanFolder }) => React.ReactElement;
  renderGroupItem: ({ item }: { item: LibraryGroupItem }) => React.ReactElement;
  renderPlaylistItem: ({ item }: { item: LibraryPlaylistItem }) => React.ReactElement;
  renderSongItem: ({ item }: { item: Song }) => React.ReactElement;
  songKeyExtractor: (item: Song) => string;
}
