import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import LibraryTabContent from '../LibraryTabContent';

const mockAppThemeContextValue = {
  appearance: 'dark',
  skin: 'graphite',
  isHydrated: true,
  setAppearance: jest.fn(),
  setSkin: jest.fn(),
  theme: {
    id: 'graphite-dark',
    appearance: 'dark',
    skin: 'graphite',
    label: 'Graphite Dark',
    navigationDark: true,
    statusBarStyle: 'light-content',
    palette: {
      background: '#07090C',
      backgroundDeep: '#030406',
      surface: '#101218',
      surfaceElevated: '#191B21',
      surfaceGlass: 'rgba(18, 20, 26, 0.76)',
      card: '#111318',
      cardElevated: '#1A1D24',
      border: 'rgba(255, 255, 255, 0.08)',
      borderStrong: 'rgba(210, 218, 230, 0.28)',
      primary: '#D8DEE8',
      primaryDark: '#87909E',
      primaryGlow: 'rgba(216, 222, 232, 0.12)',
      accent: '#BFC7D4',
      accentGlow: 'rgba(191, 199, 212, 0.10)',
      success: '#D8DEE8',
      error: '#FF6F8A',
      warning: '#FFCA77',
      text: {
        primary: '#F4F5F7',
        secondary: 'rgba(244, 245, 247, 0.70)',
        muted: 'rgba(244, 245, 247, 0.42)',
        onPrimary: '#07090C',
      },
    },
    gradients: {
      background: ['#07090C', '#101218', '#191B21'],
      nowPlaying: ['#07090C', '#191B21', '#101218'],
    },
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => mockAppThemeContextValue,
  useOptionalAppTheme: () => mockAppThemeContextValue,
}));

const baseProps = {
  activeFolders: 0,
  albumGroups: [],
  albumViewMode: 'grid' as const,
  artistGroups: [],
  emptyMessage: 'Leer',
  genreGroups: [],
  getSongItemLayout: (_: unknown, index: number) => ({ length: 62, offset: 62 * index, index }),
  onPlayActiveList: jest.fn(),
  onShuffle: jest.fn(),
  onToggleAlbumView: jest.fn(),
  newPlaylistName: '',
  onChangePlaylistName: jest.fn(),
  onCreatePlaylist: jest.fn(),
  playlistItems: [],
  renderAlbumTile: jest.fn(() => null),
  renderFolderItem: jest.fn(() => null),
  renderGroupItem: jest.fn(() => null),
  renderPlaylistItem: jest.fn(() => null),
  renderSongItem: jest.fn(() => null),
  scanFolders: [],
  songKeyExtractor: (item: { id: string }) => item.id,
  songsForActiveList: [],
  sortMode: 'alphabet' as const,
  onSelectSortMode: jest.fn(),
  songViewMode: 'list' as const,
  onCycleSongViewMode: jest.fn(),
};

test('renders folders tab shell and icon empty state', () => {
  const screen = render(<LibraryTabContent {...baseProps} activeTab="folders" />);

  expect(screen.getByTestId('library-folders-shell')).toBeTruthy();
  expect(screen.getByText('Scan-Ordner')).toBeTruthy();
  expect(screen.getByTestId('library-empty-state-folders')).toBeTruthy();
  expect(screen.getByText('Leer')).toBeTruthy();
});

test('renders tracks tab shell and icon empty state', () => {
  const screen = render(<LibraryTabContent {...baseProps} activeTab="tracks" />);

  expect(screen.getByTestId('library-tracks-shell')).toBeTruthy();
  expect(screen.getByText('Name')).toBeTruthy();
  expect(screen.getByTestId('library-empty-state-tracks')).toBeTruthy();
  expect(screen.getByText('Leer')).toBeTruthy();
});
test('renders playlist create UI in playlists tab', () => {
  const screen = render(<LibraryTabContent {...baseProps} activeTab="playlists" />);

  expect(screen.getByText('Neue Playlist erstellen')).toBeTruthy();
  expect(screen.getByTestId('library-playlist-create-card')).toBeTruthy();
  expect(screen.getByTestId('library-playlist-name-input')).toBeTruthy();
  expect(screen.getByTestId('library-playlist-create-button')).toBeTruthy();
});

test('creates playlist without selected track and clears through controlled props', () => {
  const onChangePlaylistName = jest.fn();
  const onCreatePlaylist = jest.fn();
  const screen = render(
    <LibraryTabContent
      {...baseProps}
      activeTab="playlists"
      newPlaylistName="  Roadtrip  "
      onChangePlaylistName={onChangePlaylistName}
      onCreatePlaylist={onCreatePlaylist}
    />,
  );

  fireEvent.changeText(screen.getByTestId('library-playlist-name-input'), '  Roadtrip  ');
  fireEvent.press(screen.getByTestId('library-playlist-create-button'));

  expect(onChangePlaylistName).toHaveBeenCalledWith('  Roadtrip  ');
  expect(onCreatePlaylist).toHaveBeenCalledTimes(1);
});

test('keeps playlist create UI visible when playlists exist', () => {
  const playlist = { id: 'playlist-1', name: 'Mix', songs: [], validCount: 0, totalCount: 0 };
  const renderPlaylistItem = jest.fn(({ item }) => <Text>{item.name}</Text>);

  const screen = render(
    <LibraryTabContent
      {...baseProps}
      activeTab="playlists"
      playlistItems={[playlist]}
      renderPlaylistItem={renderPlaylistItem}
    />,
  );

  expect(screen.getByTestId('library-playlist-create-card')).toBeTruthy();
  expect(screen.getByText('Mix')).toBeTruthy();
  expect(renderPlaylistItem).toHaveBeenCalled();
});
