import React from 'react';
import { FlatList, Platform, StyleSheet, Text, type ListRenderItem } from 'react-native';
import LibraryAlbumViewToggle, { type LibraryAlbumViewMode } from './LibraryAlbumViewToggle';
import LibraryListShell from './LibraryListShell';
import LibraryPlaybackActions from './LibraryPlaybackActions';
import LibrarySectionHeader from './LibrarySectionHeader';
import LibrarySortControl from './LibrarySortControl';
import LibrarySongViewControl from './LibrarySongViewControl';
import type { LibrarySortMode } from '../utils/librarySort';
import { getLibrarySongViewColumns, type LibrarySongViewMode } from '../utils/libraryViewMode';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { useAppTheme } from '../contexts/AppThemeContext';
import { theme as staticTheme } from '../theme';
import type { LibraryTab } from '../utils/libraryTabs';
import type { LibraryGroupItem } from '../utils/libraryPresentation';
import type { LibraryPlaylistItem } from '../utils/libraryPlaylists';

const GROUP_ROW_HEIGHT = 66;
const GROUP_INITIAL_RENDER_COUNT = 12;
const GROUP_WINDOW_SIZE = 7;
const SONG_INITIAL_RENDER_COUNT = 10;
const SONG_WINDOW_SIZE = 7;
const shouldRemoveClippedSubviews = Platform.OS !== 'web';

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
  onCycleSortMode: () => void;
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
  onCycleSortMode,
  songViewMode,
  onCycleSongViewMode,
}) => {
  const { theme } = useAppTheme();

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
          ListEmptyComponent={<Text style={[styles.empty, { color: theme.palette.text.muted }]}>{emptyMessage}</Text>}
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
          <FlatList
            key="library-albums-grid"
            data={albumGroups}
            keyExtractor={groupKeyExtractor}
            contentContainerStyle={styles.albumGridContent}
            renderItem={renderAlbumTile}
            numColumns={2}
            columnWrapperStyle={styles.albumColumn}
            initialNumToRender={8}
            windowSize={GROUP_WINDOW_SIZE}
            removeClippedSubviews={shouldRemoveClippedSubviews}
            ListEmptyComponent={<Text style={[styles.empty, { color: theme.palette.text.muted }]}>{emptyMessage}</Text>}
          />
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
            ListEmptyComponent={<Text style={[styles.empty, { color: theme.palette.text.muted }]}>{emptyMessage}</Text>}
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
          ListEmptyComponent={<Text style={[styles.empty, { color: theme.palette.text.muted }]}>{emptyMessage}</Text>}
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
          getItemLayout={getGroupItemLayout}
          initialNumToRender={GROUP_INITIAL_RENDER_COUNT}
          windowSize={GROUP_WINDOW_SIZE}
          removeClippedSubviews={shouldRemoveClippedSubviews}
          ListEmptyComponent={<Text style={[styles.empty, { color: theme.palette.text.muted }]}>{emptyMessage}</Text>}
        />
      </LibraryListShell>
    );
  }

  return (
    <LibraryListShell testID={`library-${activeTab}-shell`}>
      <LibrarySectionHeader title={activeTab === 'favorites' ? 'Favoriten' : 'Name'}>
        <LibrarySongViewControl mode={songViewMode} onCycle={onCycleSongViewMode} />
        <LibrarySortControl mode={sortMode} onCycle={onCycleSortMode} />
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
        ListEmptyComponent={<Text style={[styles.empty, { color: theme.palette.text.muted }]}>{emptyMessage}</Text>}
      />
    </LibraryListShell>
  );
};

const styles = StyleSheet.create({
  folderCount: { fontFamily: staticTheme.fonts.body, fontSize: 12 },
  listContent: { paddingBottom: 96 },
  albumGridContent: { paddingBottom: 104 },
  albumColumn: { gap: 12 },
  songGridColumn: { gap: 12, paddingHorizontal: 12 },
  empty: { textAlign: 'center', marginTop: 30, fontFamily: staticTheme.fonts.body },
});

export default LibraryTabContent;
