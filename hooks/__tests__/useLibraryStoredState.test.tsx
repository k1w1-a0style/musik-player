import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { useLibraryStoredState } from '../useLibraryStoredState';
import type { LibraryTab } from '../../utils/libraryTabs';
import { loadFavoriteSongIds, loadLibraryStartupState } from '../../utils/libraryStorageLoaders';
import type { ScanFolder } from '../../types/ScanFolder';

jest.mock('../../utils/libraryStorageLoaders', () => ({
  loadFavoriteSongIds: jest.fn(),
  loadLibraryStartupState: jest.fn(),
}));

const mockedLoadFavoriteSongIds = jest.mocked(loadFavoriteSongIds);
const mockedLoadLibraryStartupState = jest.mocked(loadLibraryStartupState);

const folder = (id: string): ScanFolder => ({
  id,
  name: id,
  uri: `content://${id}`,
  addedAt: 1,
  enabled: true,
});

const HookViewer = ({ activeTab }: { activeTab: LibraryTab }) => {
  const { scanFolders, favoriteIds } = useLibraryStoredState(activeTab);

  return <Text testID="stored-state">{`${scanFolders.map(item => item.id).join(',')}|${favoriteIds.join(',')}`}</Text>;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedLoadLibraryStartupState.mockResolvedValue({ scanFolders: [folder('music')], favoriteIds: ['startup-favorite'] });
  mockedLoadFavoriteSongIds.mockResolvedValue(['fresh-favorite']);
});

test('loads startup scan folders and favorite ids on mount', async () => {
  const view = render(<HookViewer activeTab="tracks" />);

  await waitFor(() => expect(view.getByTestId('stored-state').props.children).toBe('music|startup-favorite'));
  expect(mockedLoadLibraryStartupState).toHaveBeenCalledTimes(1);
  expect(mockedLoadFavoriteSongIds).not.toHaveBeenCalled();
});

test('reloads favorite ids when favorites tab becomes active', async () => {
  const view = render(<HookViewer activeTab="tracks" />);
  await waitFor(() => expect(view.getByTestId('stored-state').props.children).toBe('music|startup-favorite'));

  await act(async () => {
    view.rerender(<HookViewer activeTab="favorites" />);
  });

  await waitFor(() => expect(view.getByTestId('stored-state').props.children).toBe('music|fresh-favorite'));
  expect(mockedLoadFavoriteSongIds).toHaveBeenCalledTimes(1);
});
