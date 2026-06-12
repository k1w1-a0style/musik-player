import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryAlbumTile, { getAlbumTileFallbackLetter } from '../LibraryAlbumTile';
import type { LibraryGroupItem } from '../../utils/libraryPresentation';

const album = (patch: Partial<LibraryGroupItem> = {}): LibraryGroupItem => ({
  id: patch.id ?? 'a1',
  title: patch.title ?? 'Warehouse Dreams',
  subtitle: patch.subtitle ?? 'DJ Kiwi • 12 Titel',
  cover: patch.cover,
  songs: patch.songs ?? [],
});

test('renders album title and subtitle', () => {
  const { getByText } = render(<LibraryAlbumTile album={album()} onPress={jest.fn()} />);

  expect(getByText('Warehouse Dreams')).toBeTruthy();
  expect(getByText('DJ Kiwi • 12 Titel')).toBeTruthy();
});

test('renders first letter when no cover exists', () => {
  const { getByText } = render(<LibraryAlbumTile album={album({ title: 'techno tools' })} onPress={jest.fn()} />);

  expect(getByText('T')).toBeTruthy();
});

test('renders fallback question mark for blank album titles', () => {
  const { getByText } = render(<LibraryAlbumTile album={album({ title: '   ' })} onPress={jest.fn()} />);

  expect(getByText('?')).toBeTruthy();
  expect(getAlbumTileFallbackLetter('')).toBe('?');
});

test('renders cover when available', () => {
  const { getByTestId, queryByText } = render(<LibraryAlbumTile album={album({ id: 'covered', cover: 'file://album.jpg' })} onPress={jest.fn()} />);

  expect(getByTestId('library-album-cover-covered').props.source).toEqual({ uri: 'file://album.jpg' });
  expect(queryByText('W')).toBeNull();
});

test('calls onPress with album', () => {
  const onPress = jest.fn();
  const item = album({ id: 'press-me' });
  const { getByTestId } = render(<LibraryAlbumTile album={item} onPress={onPress} />);

  fireEvent.press(getByTestId('library-album-tile-press-me'));

  expect(onPress).toHaveBeenCalledWith(item);
});
