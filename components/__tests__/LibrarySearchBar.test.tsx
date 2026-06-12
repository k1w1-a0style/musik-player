import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibrarySearchBar from '../LibrarySearchBar';

test('renders current search value', () => {
  const { getByTestId } = render(<LibrarySearchBar value="techno" onChangeText={jest.fn()} />);

  expect(getByTestId('library-search-input').props.value).toBe('techno');
});

test('calls onChangeText when typing', () => {
  const onChangeText = jest.fn();
  const { getByTestId } = render(<LibrarySearchBar value="" onChangeText={onChangeText} />);

  fireEvent.changeText(getByTestId('library-search-input'), 'album');

  expect(onChangeText).toHaveBeenCalledWith('album');
});

test('passes autoFocus to text input', () => {
  const { getByTestId } = render(<LibrarySearchBar value="" onChangeText={jest.fn()} autoFocus />);

  expect(getByTestId('library-search-input').props.autoFocus).toBe(true);
});

test('uses localized accessibility label and placeholder', () => {
  const { getByTestId } = render(<LibrarySearchBar value="" onChangeText={jest.fn()} />);

  expect(getByTestId('library-search-input').props.accessibilityLabel).toBe(
    'Bibliothek durchsuchen',
  );
  expect(getByTestId('library-search-input').props.placeholder).toBe(
    'Titel, Künstler, Album, Genre suchen',
  );
});
