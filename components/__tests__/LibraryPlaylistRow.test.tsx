import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryPlaylistRow from '../LibraryPlaylistRow';
import type { LibraryPlaylistItem } from '../../utils/libraryPlaylists';

const mockAppTheme = {
  palette: {
    surfaceGlass: 'rgba(18, 20, 26, 0.76)',
    border: 'rgba(255, 255, 255, 0.08)',
    primary: '#D8DEE8',
    error: '#FF6F8A',
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

const playlist = (patch: Partial<LibraryPlaylistItem> = {}): LibraryPlaylistItem => ({
  id: patch.id ?? 'p1',
  name: patch.name ?? 'Mix',
  songs: patch.songs ?? [],
  validCount: patch.validCount ?? 2,
  totalCount: patch.totalCount ?? 2,
});

const renderRow = (item: LibraryPlaylistItem = playlist(), props: Partial<React.ComponentProps<typeof LibraryPlaylistRow>> = {}) => render(
  <LibraryPlaylistRow
    playlist={item}
    onOpen={props.onOpen ?? jest.fn()}
    onPlay={props.onPlay ?? jest.fn()}
  />,
);

test('renders playlist name and track count', () => {
  const { getByText } = renderRow();

  expect(getByText('Mix')).toBeTruthy();
  expect(getByText('2 Titel')).toBeTruthy();
});

test('renders singular track label', () => {
  const { getByText } = renderRow(playlist({ validCount: 1, totalCount: 1 }));

  expect(getByText('1 Titel')).toBeTruthy();
});

test('renders warning for missing songs', () => {
  const { getByText } = renderRow(playlist({ validCount: 2, totalCount: 5 }));

  expect(getByText('3 nicht mehr gefunden')).toBeTruthy();
});

test('calls onOpen with playlist id from the row body', () => {
  const onOpen = jest.fn();
  const { getByTestId } = renderRow(playlist({ id: 'open-me' }), { onOpen });

  fireEvent.press(getByTestId('open-playlist-open-me'));

  expect(onOpen).toHaveBeenCalledWith('open-me');
});

test('calls onPlay with playlist id', () => {
  const onPlay = jest.fn();
  const { getByTestId } = renderRow(playlist({ id: 'play-me' }), { onPlay });

  fireEvent.press(getByTestId('play-playlist-play-me'));

  expect(onPlay).toHaveBeenCalledWith('play-me');
});

test('disables play button for empty playlist but still allows opening details', () => {
  const onOpen = jest.fn();
  const onPlay = jest.fn();
  const { getByTestId } = renderRow(playlist({ id: 'empty', validCount: 0, totalCount: 0 }), { onOpen, onPlay });

  const button = getByTestId('play-playlist-empty');
  expect(button.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(button);
  fireEvent.press(getByTestId('open-playlist-empty'));

  expect(onPlay).not.toHaveBeenCalled();
  expect(onOpen).toHaveBeenCalledWith('empty');
});

test('uses app theme row chrome and text colors', () => {
  const { getByTestId, getByText } = renderRow();

  expect(JSON.stringify(getByTestId('library-playlist-p1').props.style)).toContain(mockAppTheme.palette.border);
  expect(JSON.stringify(getByTestId('library-playlist-icon-p1').props.style)).toContain(mockAppTheme.palette.surfaceGlass);
  expect(JSON.stringify(getByTestId('library-playlist-icon-p1').props.style)).toContain(mockAppTheme.palette.border);
  expect(JSON.stringify(getByText('Mix').props.style)).toContain(mockAppTheme.palette.text.primary);
  expect(JSON.stringify(getByText('2 Titel').props.style)).toContain(mockAppTheme.palette.text.secondary);
});

test('uses app theme warning color', () => {
  const { getByText } = renderRow(playlist({ validCount: 2, totalCount: 5 }));

  expect(JSON.stringify(getByText('3 nicht mehr gefunden').props.style)).toContain(mockAppTheme.palette.error);
});
