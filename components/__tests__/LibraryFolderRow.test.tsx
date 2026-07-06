import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryFolderRow from '../LibraryFolderRow';
import type { ScanFolder } from '../../types/ScanFolder';

const mockAppTheme = {
  palette: {
    surfaceGlass: 'rgba(18, 20, 26, 0.76)',
    border: 'rgba(255, 255, 255, 0.08)',
    text: {
      primary: '#F4F5F7',
      secondary: 'rgba(244, 245, 247, 0.70)',
      muted: 'rgba(244, 245, 247, 0.42)',
    },
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    theme: mockAppTheme,
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: jest.fn(),
    setSkin: jest.fn(),
  }),
}));

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

test('uses app theme row chrome and text colors', () => {
  const { getByTestId, getByText } = render(<LibraryFolderRow folder={folder()} onRemove={jest.fn()} />);

  expect(JSON.stringify(getByTestId('library-folder-row-f1').props.style)).toContain(mockAppTheme.palette.border);
  expect(JSON.stringify(getByTestId('remove-folder-f1').props.style)).toContain(mockAppTheme.palette.surfaceGlass);
  expect(JSON.stringify(getByTestId('remove-folder-f1').props.style)).toContain(mockAppTheme.palette.border);
  expect(JSON.stringify(getByText('Music').props.style)).toContain(mockAppTheme.palette.text.primary);
  expect(JSON.stringify(getByText('content://music').props.style)).toContain(mockAppTheme.palette.text.muted);
  expect(JSON.stringify(getByText('Entfernen').props.style)).toContain(mockAppTheme.palette.text.secondary);
});
