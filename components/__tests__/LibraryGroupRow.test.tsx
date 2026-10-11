import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryGroupRow from '../LibraryGroupRow';
import type { LibraryGroupItem } from '../../utils/libraryPresentation';
import { useArtworkThumbnail } from '../../hooks/useArtworkThumbnail';
jest.mock('../../hooks/useArtworkThumbnail', () => ({ useArtworkThumbnail: jest.fn((uri?: string) => uri) }));
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

const group = (patch: Partial<LibraryGroupItem> = {}): LibraryGroupItem => ({
  id: patch.id ?? 'g1',
  title: patch.title ?? 'Techno',
  subtitle: patch.subtitle ?? '2 Titel',
  cover: patch.cover,
  songs: patch.songs ?? [],
});

test('renders group title and subtitle', () => {
  const { getByText } = render(<LibraryGroupRow group={group()} onPress={jest.fn()} />);

  expect(getByText('Techno')).toBeTruthy();
  expect(getByText('2 Titel')).toBeTruthy();
});

test('renders first letter when no cover exists', () => {
  const { getByText } = render(<LibraryGroupRow group={group({ title: 'albums' })} onPress={jest.fn()} />);

  expect(getByText('A')).toBeTruthy();
});

test('renders cover when available', () => {
  const { getByTestId, queryByText } = render(<LibraryGroupRow group={group({ id: 'covered', cover: 'file://cover.jpg' })} onPress={jest.fn()} />);

  expect(getByTestId('library-group-cover-covered').props.source).toEqual({ uri: 'file://cover.jpg' });
  expect(queryByText('T')).toBeNull();
});

test('calls onPress with group', () => {
  const onPress = jest.fn();
  const item = group({ id: 'press-me' });
  const { getByTestId } = render(<LibraryGroupRow group={item} onPress={onPress} />);

  fireEvent.press(getByTestId('library-group-row-press-me'));

  expect(onPress).toHaveBeenCalledWith(item);
});

test('a broken thumbnail falls back to the original, then a letter; changing cover resets errors', () => {
  (useArtworkThumbnail as jest.Mock).mockReturnValue('file:///cache/thumb.png');
  const first = group({ id: 'covered', cover: 'file:///original.jpg' });
  const screen = render(<LibraryGroupRow group={first} onPress={jest.fn()} />);
  expect(useArtworkThumbnail).toHaveBeenCalledWith(first.cover, 128);
  expect(screen.getByTestId('library-group-cover-covered').props.source.uri).toBe('file:///cache/thumb.png');
  fireEvent(screen.getByTestId('library-group-cover-covered'), 'error');
  expect(screen.getByTestId('library-group-cover-covered').props.source.uri).toBe(first.cover);
  fireEvent(screen.getByTestId('library-group-cover-covered'), 'error');
  expect(screen.queryByTestId('library-group-cover-covered')).toBeNull();
  expect(screen.getByText('T')).toBeTruthy();
  screen.rerender(<LibraryGroupRow group={group({ id: 'covered', cover: 'file:///new.jpg' })} onPress={jest.fn()} />);
  expect(screen.getByTestId('library-group-cover-covered').props.source.uri).toBe('file:///cache/thumb.png');
});
