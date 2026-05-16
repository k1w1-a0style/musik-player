import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryAlbumViewToggle from '../LibraryAlbumViewToggle';

test('renders list hint while in grid mode', () => {
  const { getByTestId } = render(<LibraryAlbumViewToggle mode="grid" onToggle={jest.fn()} />);

  expect(getByTestId('library-album-view-toggle').props.accessibilityHint).toBe('Wechselt zur Listenansicht');
});

test('renders grid hint while in list mode', () => {
  const { getByTestId } = render(<LibraryAlbumViewToggle mode="list" onToggle={jest.fn()} />);

  expect(getByTestId('library-album-view-toggle').props.accessibilityHint).toBe('Wechselt zur Rasteransicht');
});

test('calls onToggle when pressed', () => {
  const onToggle = jest.fn();
  const { getByTestId } = render(<LibraryAlbumViewToggle mode="grid" onToggle={onToggle} />);

  fireEvent.press(getByTestId('library-album-view-toggle'));

  expect(onToggle).toHaveBeenCalledTimes(1);
});
