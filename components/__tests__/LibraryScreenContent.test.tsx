import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import LibraryScreenContent, { type LibraryScreenContentProps } from '../LibraryScreenContent';

const mockRenderText = (children: string) => <Text>{children}</Text>;

jest.mock('../LibraryTopBar', () => () => mockRenderText('Top Bar'));
jest.mock('../LibraryTabs', () => () => mockRenderText('Tabs'));
jest.mock('../LibrarySearchBar', () => ({ value }: { value: string }) => mockRenderText(`Search: ${value}`));
jest.mock('../LibraryImportStatus', () => ({ status }: { status: string | null }) => mockRenderText(`Status: ${status}`));
jest.mock('../LibraryTabContent', () => () => mockRenderText('Tab Content'));
jest.mock('../LibraryMenuModal', () => () => mockRenderText('Menu Modal'));
jest.mock('../SongActionMenuModal', () => () => mockRenderText('Song Action Menu'));
jest.mock('../SongPlaylistPickerModal', () => () => mockRenderText('Song Playlist Picker'));

const fn = jest.fn();

const baseProps = {
  importStatusProps: { status: 'Import läuft' },
  menuModalProps: {
    visible: false,
    loading: false,
    isReady: true,
    hasSongs: false,
    activeFolders: 0,
    onClose: fn,
    onImport: fn,
    onRefreshMetadata: fn,
    onAddFolder: fn,
    onShowFolders: fn,
    onOpenSettings: fn,
    onOpenEqualizer: fn,
  },
  searchBarProps: { autoFocus: true, onChangeText: fn, value: 'abc' },
  showImportStatus: true,
  showSearchBar: true,
  tabContentProps: {
    activeTab: 'tracks',
    activeFolders: 0,
    albumGroups: [],
    albumViewMode: 'grid',
    artistGroups: [],
    emptyMessage: 'Leer',
    genreGroups: [],
    getSongItemLayout: fn,
    onPlayActiveList: fn,
    onShuffle: fn,
    onToggleAlbumView: fn,
    newPlaylistName: '',
    onChangePlaylistName: fn,
    onCreatePlaylist: fn,
    playlistItems: [],
    renderAlbumTile: fn,
    renderFolderItem: fn,
    renderGroupItem: fn,
    renderPlaylistItem: fn,
    renderSongItem: fn,
    scanFolders: [],
    songKeyExtractor: (item: { id: string }) => item.id,
    songsForActiveList: [],
    sortMode: 'alphabet',
    onSelectSortMode: fn,
    songViewMode: 'list',
    onCycleSongViewMode: fn,
  },
  tabsProps: { activeTab: 'tracks', onChangeTab: fn },
  topBarProps: { onOpenMenu: fn, onToggleSearch: fn },
  songActionMenuProps: { visible: false, onClose: fn, onOpenTrackInfo: fn, onOpenPlaylistPicker: fn },
  songPlaylistPickerProps: { visible: false, song: null, playlists: [], onClose: fn, onTogglePlaylist: fn },
} as LibraryScreenContentProps;

test('renders library screen sections', () => {
  const screen = render(<LibraryScreenContent {...baseProps} />);

  expect(screen.getByText('Top Bar')).toBeTruthy();
  expect(screen.getByText('Tabs')).toBeTruthy();
  expect(screen.getByText('Search: abc')).toBeTruthy();
  expect(screen.getByText('Status: Import läuft')).toBeTruthy();
  expect(screen.getByText('Tab Content')).toBeTruthy();
  expect(screen.getByText('Menu Modal')).toBeTruthy();
});

test('hides search and status when inactive', () => {
  const screen = render(<LibraryScreenContent {...baseProps} showImportStatus={false} showSearchBar={false} />);

  expect(screen.queryByText('Search: abc')).toBeNull();
  expect(screen.queryByText('Status: Import läuft')).toBeNull();
});
