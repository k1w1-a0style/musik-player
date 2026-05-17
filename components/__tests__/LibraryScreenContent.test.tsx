import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import LibraryScreenContent from '../LibraryScreenContent';

jest.mock('../LibraryTopBar', () => () => <Text>Top Bar</Text>);
jest.mock('../LibraryTabs', () => () => <Text>Tabs</Text>);
jest.mock('../LibrarySearchBar', () => ({ value }: { value: string }) => <Text>Search: {value}</Text>);
jest.mock('../LibraryImportStatus', () => ({ status }: { status: string | null }) => <Text>Status: {status}</Text>);
jest.mock('../LibraryTabContent', () => () => <Text>Tab Content</Text>);
jest.mock('../LibraryMenuModal', () => () => <Text>Menu Modal</Text>);

const fn = jest.fn();

const baseProps = {
  activeTab: 'tracks' as const,
  importStatus: 'Import läuft',
  loading: true,
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
  },
  query: 'abc',
  searchOpen: true,
  setActiveTab: fn,
  setQuery: fn,
  tabContentProps: {
    activeTab: 'tracks' as const,
    activeFolders: 0,
    albumGroups: [],
    albumViewMode: 'grid' as const,
    artistGroups: [],
    emptyMessage: 'Leer',
    genreGroups: [],
    getSongItemLayout: fn,
    onPlayActiveList: fn,
    onShuffle: fn,
    onToggleAlbumView: fn,
    playlistItems: [],
    renderAlbumTile: fn,
    renderFolderItem: fn,
    renderGroupItem: fn,
    renderPlaylistItem: fn,
    renderSongItem: fn,
    scanFolders: [],
    songKeyExtractor: (item: { id: string }) => item.id,
    songsForActiveList: [],
  },
  topBarProps: {
    onOpenMenu: fn,
    onToggleSearch: fn,
  },
};

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
  const screen = render(<LibraryScreenContent {...baseProps} loading={false} searchOpen={false} />);

  expect(screen.queryByText('Search: abc')).toBeNull();
  expect(screen.queryByText('Status: Import läuft')).toBeNull();
});
