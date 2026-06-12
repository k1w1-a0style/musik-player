import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryPlaylistRow from '../LibraryPlaylistRow';
import type { LibraryPlaylistItem } from '../../utils/libraryPlaylists';

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
