import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryFolderRow from '../LibraryFolderRow';
import type { ScanFolder } from '../../types/ScanFolder';

jest.mock('../../utils/libraryPresentation', () => ({
  displayFolderName: (folder: ScanFolder) => folder.name || 'Ordner',
}));

const folder = (patch: Partial<ScanFolder> = {}): ScanFolder => ({
  id: patch.id ?? 'f1',
  name: patch.name ?? 'Music',
  uri: patch.uri ?? 'content://music',
  addedAt: patch.addedAt ?? 1,
  enabled: patch.enabled ?? true,
  lastError: patch.lastError,
});

test('renders folder name and uri', () => {
  const { getByText } = render(<LibraryFolderRow folder={folder()} onRemove={jest.fn()} />);

  expect(getByText('Music')).toBeTruthy();
  expect(getByText('content://music')).toBeTruthy();
});

test('renders last error instead of uri when present', () => {
  const { getByText, queryByText } = render(<LibraryFolderRow folder={folder({ lastError: 'Nicht lesbar' })} onRemove={jest.fn()} />);

  expect(getByText('Nicht lesbar')).toBeTruthy();
  expect(queryByText('content://music')).toBeNull();
});

test('calls onRemove with folder', () => {
  const onRemove = jest.fn();
  const item = folder({ id: 'remove-me' });
  const { getByTestId } = render(<LibraryFolderRow folder={item} onRemove={onRemove} />);

  fireEvent.press(getByTestId('remove-folder-remove-me'));

  expect(onRemove).toHaveBeenCalledWith(item);
});
