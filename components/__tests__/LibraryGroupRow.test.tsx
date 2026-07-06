import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryGroupRow from '../LibraryGroupRow';
import type { LibraryGroupItem } from '../../utils/libraryPresentation';
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
