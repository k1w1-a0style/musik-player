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

test('renders playlist name and track count', () => {
  const { getByText } = render(<LibraryPlaylistRow playlist={playlist()} onPlay={jest.fn()} />);

  expect(getByText('Mix')).toBeTruthy();
  expect(getByText('2 Titel')).toBeTruthy();
});

test('renders singular track label', () => {
  const { getByText } = render(<LibraryPlaylistRow playlist={playlist({ validCount: 1, totalCount: 1 })} onPlay={jest.fn()} />);

  expect(getByText('1 Titel')).toBeTruthy();
});

test('renders warning for missing songs', () => {
  const { getByText } = render(<LibraryPlaylistRow playlist={playlist({ validCount: 2, totalCount: 5 })} onPlay={jest.fn()} />);

  expect(getByText('3 nicht mehr gefunden')).toBeTruthy();
});

test('calls onPlay with playlist id', () => {
  const onPlay = jest.fn();
  const { getByTestId } = render(<LibraryPlaylistRow playlist={playlist({ id: 'play-me' })} onPlay={onPlay} />);

  fireEvent.press(getByTestId('play-playlist-play-me'));

  expect(onPlay).toHaveBeenCalledWith('play-me');
});

test('disables play button for empty playlist', () => {
  const onPlay = jest.fn();
  const { getByTestId } = render(<LibraryPlaylistRow playlist={playlist({ id: 'empty', validCount: 0, totalCount: 0 })} onPlay={onPlay} />);

  const button = getByTestId('play-playlist-empty');
  expect(button.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(button);

  expect(onPlay).not.toHaveBeenCalled();
});

test('uses app theme row chrome and text colors', () => {
  const { getByTestId, getByText } = render(<LibraryPlaylistRow playlist={playlist()} onPlay={jest.fn()} />);

  expect(JSON.stringify(getByTestId('library-playlist-p1').props.style)).toContain(mockAppTheme.palette.border);
  expect(JSON.stringify(getByTestId('library-playlist-icon-p1').props.style)).toContain(mockAppTheme.palette.surfaceGlass);
  expect(JSON.stringify(getByTestId('library-playlist-icon-p1').props.style)).toContain(mockAppTheme.palette.border);
  expect(JSON.stringify(getByText('Mix').props.style)).toContain(mockAppTheme.palette.text.primary);
  expect(JSON.stringify(getByText('2 Titel').props.style)).toContain(mockAppTheme.palette.text.secondary);
});

test('uses app theme warning color', () => {
  const { getByText } = render(<LibraryPlaylistRow playlist={playlist({ validCount: 2, totalCount: 5 })} onPlay={jest.fn()} />);

  expect(JSON.stringify(getByText('3 nicht mehr gefunden').props.style)).toContain(mockAppTheme.palette.error);
});
