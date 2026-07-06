import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryAlbumViewToggle from '../LibraryAlbumViewToggle';
const mockAppTheme = {
  palette: {
    surfaceGlass: 'rgba(18, 20, 26, 0.76)',
    border: 'rgba(255, 255, 255, 0.08)',
    primary: '#D8DEE8',
    error: '#FF6F8A',
    warning: '#FFCA77',
    text: {
      primary: '#F4F5F7',
      secondary: 'rgba(244, 245, 247, 0.70)',
      muted: 'rgba(244, 245, 247, 0.42)',
      onPrimary: '#07090C',
    },
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: () => undefined,
    setSkin: () => undefined,
    theme: mockAppTheme,
  }),
}));

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
