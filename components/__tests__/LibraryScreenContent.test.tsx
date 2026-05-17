import mockReact from 'react';
import { Text as mockText } from 'react-native';
import { render } from '@testing-library/react-native';
import LibraryScreenContent from '../LibraryScreenContent';

jest.mock('../LibraryTopBar', () => () => mockReact.createElement(mockText, null, 'Top Bar'));
jest.mock('../LibraryTabs', () => () => mockReact.createElement(mockText, null, 'Tabs'));
jest.mock('../LibrarySearchBar', () => ({ value }: { value: string }) => mockReact.createElement(mockText, null, `Search: ${value}`));
jest.mock('../LibraryImportStatus', () => ({ status }: { status: string | null }) => mockReact.createElement(mockText, null, `Status: ${status}`));
jest.mock('../LibraryTabContent', () => () => mockReact.createElement(mockText, null, 'Tab Content'));
jest.mock('../LibraryMenuModal', () => () => mockReact.createElement(mockText, null, 'Menu Modal'));

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
