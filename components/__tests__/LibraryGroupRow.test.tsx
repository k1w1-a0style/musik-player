import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryGroupRow from '../LibraryGroupRow';
import type { LibraryGroupItem } from '../../utils/libraryPresentation';

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
