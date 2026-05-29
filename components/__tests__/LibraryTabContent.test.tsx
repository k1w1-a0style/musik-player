import React from 'react';
import { render } from '@testing-library/react-native';
import LibraryTabContent from '../LibraryTabContent';

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
