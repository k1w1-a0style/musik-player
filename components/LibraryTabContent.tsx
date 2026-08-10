import React, { useCallback } from 'react';
import { FlatList, Platform, StyleSheet, Text, View, useWindowDimensions,
  type ListRenderItem, type ListRenderItemInfo } from 'react-native';
import LibraryAlbumViewToggle from './LibraryAlbumViewToggle';
import type { LibraryAlbumViewMode } from '../types/LibraryView';
import LibraryEmptyState from './LibraryEmptyState';
import LibraryListShell from './LibraryListShell';
import LibraryPlaybackActions from './LibraryPlaybackActions';
import LibrarySectionHeader from './LibrarySectionHeader';
import LibrarySortControl from './LibrarySortControl';
import LibrarySongViewControl from './LibrarySongViewControl';
import PlaylistCreateForm from '../screens/PlaylistCreateForm';
import type { LibrarySortMode } from '../utils/librarySort';
import { getLibrarySongViewColumns, type LibrarySongViewMode } from '../utils/libraryViewMode';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import type { LibraryTab } from '../utils/libraryTabs';
import type { LibraryGroupItem } from '../utils/libraryPresentation';
import type { LibraryPlaylistItem } from '../utils/libraryPlaylists';

const GROUP_ROW_HEIGHT = 66;
const GROUP_INITIAL_RENDER_COUNT = 12;
const GROUP_WINDOW_SIZE = 7;
const SONG_INITIAL_RENDER_COUNT = 10;
const SONG_WINDOW_SIZE = 7;
const shouldRemoveClippedSubviews = Platform.OS !== 'web';
const ALBUM_GRID_GAP = 12;
const LIBRARY_HORIZONTAL_PADDING = 40;

export const getResponsiveAlbumGridMetrics = (windowWidth: number) => {
  const contentWidth = Math.max(1, windowWidth - LIBRARY_HORIZONTAL_PADDING);
  const columns = contentWidth >= 920 ? 5 : contentWidth >= 700 ? 4 : contentWidth >= 500 ? 3 : 2;
  const tileWidth = Math.max(1, Math.floor((contentWidth - ALBUM_GRID_GAP * (columns - 1)) / columns));
  return { columns, tileWidth };
};

const ResponsiveAlbumGrid = ({ albumGroups, emptyState, renderAlbumTile }: {
  albumGroups: LibraryGroupItem[];
  emptyState: React.ReactElement;
  renderAlbumTile: ListRenderItem<LibraryGroupItem>;
}) => {
  const { width } = useWindowDimensions();
  const { columns, tileWidth } = getResponsiveAlbumGridMetrics(width);
  const renderGridItem = useCallback((info: ListRenderItemInfo<LibraryGroupItem>) => (
    <View style={{ width: tileWidth }} testID={`library-album-cell-${info.item.id}`}>
      {renderAlbumTile(info)}
    </View>
  ), [renderAlbumTile, tileWidth]);
  return <FlatList key={`library-albums-grid-${columns}`} data={albumGroups}
    keyExtractor={groupKeyExtractor} contentContainerStyle={styles.albumGridContent}
    renderItem={renderGridItem} numColumns={columns} columnWrapperStyle={styles.albumColumn}
    initialNumToRender={8} windowSize={GROUP_WINDOW_SIZE}
    removeClippedSubviews={shouldRemoveClippedSubviews} ListEmptyComponent={emptyState} />;
};

interface SongItemLayout {
  length: number;
  offset: number;
  index: number;
}

export interface LibraryTabContentProps {
  activeTab: LibraryTab;
  activeFolders: number;
  albumGroups: LibraryGroupItem[];
  albumViewMode: LibraryAlbumViewMode;
  artistGroups: LibraryGroupItem[];
  emptyMessage: string;
  genreGroups: LibraryGroupItem[];
  getSongItemLayout: (_: ArrayLike<Song> | null | undefined, index: number) => SongItemLayout;
  onPlayActiveList: () => void;
  onShuffle: () => void;
  onToggleAlbumView: () => void;
  newPlaylistName: string;
  onChangePlaylistName: (value: string) => void;
  onCreatePlaylist: () => void;
  playlistItems: LibraryPlaylistItem[];
  renderAlbumTile: ListRenderItem<LibraryGroupItem>;
  renderFolderItem: ListRenderItem<ScanFolder>;
  renderGroupItem: ListRenderItem<LibraryGroupItem>;
  renderPlaylistItem: ListRenderItem<LibraryPlaylistItem>;
  renderSongItem: ListRenderItem<Song>;
  scanFolders: ScanFolder[];
  songKeyExtractor: (item: Song) => string;
  songsForActiveList: Song[];
  sortMode: LibrarySortMode;
  onSelectSortMode: (mode: LibrarySortMode) => void;
  songViewMode: LibrarySongViewMode;
  onCycleSongViewMode: () => void;
}

const groupKeyExtractor = (item: LibraryGroupItem | LibraryPlaylistItem): string => item.id;
const folderKeyExtractor = (item: ScanFolder): string => item.id;

const getGroupItemLayout = (_: ArrayLike<LibraryGroupItem | LibraryPlaylistItem> | null | undefined, index: number) => ({
  length: GROUP_ROW_HEIGHT,
  offset: GROUP_ROW_HEIGHT * index,
  index,
});

const LibraryTabContent: React.FC<LibraryTabContentProps> = ({
  activeTab,
  activeFolders,
  albumGroups,
  albumViewMode,
  artistGroups,
  emptyMessage,
  genreGroups,
  getSongItemLayout,
  onPlayActiveList,
  onShuffle,
  onToggleAlbumView,
  newPlaylistName,
  onChangePlaylistName,
  onCreatePlaylist,
  playlistItems,
  renderAlbumTile,
  renderFolderItem,
  renderGroupItem,
  renderPlaylistItem,
  renderSongItem,
  scanFolders,
  songKeyExtractor,
  songsForActiveList,
  sortMode,
  onSelectSortMode,
  songViewMode,
  onCycleSongViewMode,
}) => {
  const { theme } = useAppTheme();
  const emptyState = <LibraryEmptyState activeTab={activeTab} message={emptyMessage} />;

  if (activeTab === 'folders') {
    return (
      <LibraryListShell testID="library-folders-shell">
        <LibrarySectionHeader title="Scan-Ordner" count={`${activeFolders} aktiv`} />
        <FlatList
          key="library-folders-list"
          data={scanFolders}
          keyExtractor={folderKeyExtractor}
          contentContainerStyle={styles.listContent}
          renderItem={renderFolderItem}
          initialNumToRender={GROUP_INITIAL_RENDER_COUNT}
          windowSize={GROUP_WINDOW_SIZE}
          removeClippedSubviews={shouldRemoveClippedSubviews}
          ListEmptyComponent={emptyState}
        />
      </LibraryListShell>
    );
  }

  if (activeTab === 'albums') {
    return (
      <LibraryListShell testID="library-albums-shell">
        <LibrarySectionHeader title="Alben">
          <Text style={[styles.folderCount, { color: theme.palette.text.muted }]}>{albumGroups.length}</Text>
          <LibraryAlbumViewToggle mode={albumViewMode} onToggle={onToggleAlbumView} />
        </LibrarySectionHeader>
        {albumViewMode === 'grid' ? (
          <ResponsiveAlbumGrid albumGroups={albumGroups} emptyState={emptyState}
            renderAlbumTile={renderAlbumTile} />
        ) : (
          <FlatList
            key="library-albums-list"
            data={albumGroups}
            keyExtractor={groupKeyExtractor}
            contentContainerStyle={styles.listContent}
            renderItem={renderGroupItem}
            getItemLayout={getGroupItemLayout}
            initialNumToRender={GROUP_INITIAL_RENDER_COUNT}
            windowSize={GROUP_WINDOW_SIZE}
            removeClippedSubviews={shouldRemoveClippedSubviews}
            ListEmptyComponent={emptyState}
          />
        )}
      </LibraryListShell>
    );
  }

  if (activeTab === 'artists' || activeTab === 'genres') {
    const groups = activeTab === 'artists' ? artistGroups : genreGroups;

    return (
      <LibraryListShell testID={`library-${activeTab}-shell`}>
        <LibrarySectionHeader title={activeTab === 'artists' ? 'Interpreten' : 'Genres'} count={groups.length} />
        <FlatList
          key={`library-${activeTab}-groups-list`}
          data={groups}
          keyExtractor={groupKeyExtractor}
          contentContainerStyle={styles.listContent}
          renderItem={renderGroupItem}
          getItemLayout={getGroupItemLayout}
          initialNumToRender={GROUP_INITIAL_RENDER_COUNT}
          windowSize={GROUP_WINDOW_SIZE}
          removeClippedSubviews={shouldRemoveClippedSubviews}
          ListEmptyComponent={emptyState}
        />
      </LibraryListShell>
    );
  }

  if (activeTab === 'playlists') {
    return (
      <LibraryListShell testID="library-playlists-shell">
        <LibrarySectionHeader title="Playlisten" count={playlistItems.length} />
        <FlatList
          key="library-playlists-list"
          data={playlistItems}
          keyExtractor={groupKeyExtractor}
          contentContainerStyle={styles.listContent}
          renderItem={renderPlaylistItem}
          initialNumToRender={GROUP_INITIAL_RENDER_COUNT}
          windowSize={GROUP_WINDOW_SIZE}
          removeClippedSubviews={shouldRemoveClippedSubviews}
          ListHeaderComponent={(
            <PlaylistCreateForm
              value={newPlaylistName}
              onChangeText={onChangePlaylistName}
              onSubmit={onCreatePlaylist}
              cardTestID="library-playlist-create-card"
              inputTestID="library-playlist-name-input"
              buttonTestID="library-playlist-create-button"
              helperText="Erstelle eine leere Playlist und füge später Titel hinzu."
            />
          )}
          ListEmptyComponent={emptyState}
        />
      </LibraryListShell>
    );
  }

  return (
    <LibraryListShell testID={`library-${activeTab}-shell`}>
      <LibrarySectionHeader title={activeTab === 'favorites' ? 'Favoriten' : 'Titel'}>
        <LibrarySongViewControl mode={songViewMode} onCycle={onCycleSongViewMode} />
        <LibrarySortControl mode={sortMode} onSelect={onSelectSortMode} />
        <LibraryPlaybackActions
          disabled={songsForActiveList.length === 0}
          showFavoriteIcon={activeTab === 'favorites'}
          onShuffle={onShuffle}
          onPlay={onPlayActiveList}
        />
      </LibrarySectionHeader>
      <FlatList
        key={`library-${activeTab}-songs-${songViewMode}`}
        data={songsForActiveList}
        keyExtractor={songKeyExtractor}
        numColumns={getLibrarySongViewColumns(songViewMode)}
        columnWrapperStyle={getLibrarySongViewColumns(songViewMode) > 1 ? styles.songGridColumn : undefined}
        contentContainerStyle={styles.listContent}
        renderItem={renderSongItem}
        removeClippedSubviews={shouldRemoveClippedSubviews}
        windowSize={SONG_WINDOW_SIZE}
        initialNumToRender={SONG_INITIAL_RENDER_COUNT}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={80}
        getItemLayout={songViewMode === 'list' ? getSongItemLayout : undefined}
        ListEmptyComponent={emptyState}
      />
    </LibraryListShell>
  );
};

const styles = StyleSheet.create({
  folderCount: { fontFamily: staticTokens.fonts.body, fontSize: 12 },
  listContent: { paddingBottom: 96 },
  albumGridContent: { paddingBottom: 104 },
  albumColumn: { gap: ALBUM_GRID_GAP },
  songGridColumn: { gap: 12, paddingHorizontal: 12 },
});

export default LibraryTabContent;
