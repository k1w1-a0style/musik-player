import React from 'react';
import { render } from '@testing-library/react-native';
import LibraryTabContent from '../LibraryTabContent';

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: jest.fn(),
    setSkin: jest.fn(),
    theme: {
      palette: {
        background: '#07090C',
        surface: '#101218',
        surfaceElevated: '#191B21',
        surfaceGlass: 'rgba(18, 20, 26, 0.76)',
        border: 'rgba(255, 255, 255, 0.08)',
        borderStrong: 'rgba(210, 218, 230, 0.28)',
        primary: '#D8DEE8',
        primaryDark: '#87909E',
        primaryGlow: 'rgba(216, 222, 232, 0.12)',
        error: '#FF6F8A',
        text: {
          primary: '#F4F5F7',
          secondary: 'rgba(244, 245, 247, 0.70)',
          muted: 'rgba(244, 245, 247, 0.42)',
          onPrimary: '#07090C',
        },
      },
      gradients: {
        background: ['#07090C', '#101218'],
        nowPlaying: ['#07090C', '#191B21'],
      },
    },
  }),
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
  onCycleSortMode: jest.fn(),
  songViewMode: 'list' as const,
  onCycleSongViewMode: jest.fn(),
};

test('renders folders tab shell and empty message', () => {
  const screen = render(<LibraryTabContent {...baseProps} activeTab="folders" />);

  expect(screen.getByTestId('library-folders-shell')).toBeTruthy();
  expect(screen.getByText('Scan-Ordner')).toBeTruthy();
  expect(screen.getByText('Leer')).toBeTruthy();
});

test('renders tracks tab shell and playback header', () => {
  const screen = render(<LibraryTabContent {...baseProps} activeTab="tracks" />);

  expect(screen.getByTestId('library-tracks-shell')).toBeTruthy();
  expect(screen.getByText('Name')).toBeTruthy();
  expect(screen.getByText('Leer')).toBeTruthy();
});
