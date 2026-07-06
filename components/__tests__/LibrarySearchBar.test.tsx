import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibrarySearchBar from '../LibrarySearchBar';

const mockAppTheme = {
  palette: {
    surfaceGlass: 'rgba(18, 20, 26, 0.76)',
    border: 'rgba(255, 255, 255, 0.08)',
    text: {
      primary: '#F4F5F7',
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

test('uses app theme chrome', () => {
  const { getByTestId } = render(<LibrarySearchBar value="" onChangeText={jest.fn()} />);

  expect(JSON.stringify(getByTestId('library-search-bar').props.style)).toContain(mockAppTheme.palette.surfaceGlass);
  expect(JSON.stringify(getByTestId('library-search-bar').props.style)).toContain(mockAppTheme.palette.border);
  expect(JSON.stringify(getByTestId('library-search-input').props.style)).toContain(mockAppTheme.palette.text.primary);
  expect(getByTestId('library-search-input').props.placeholderTextColor).toBe(mockAppTheme.palette.text.muted);
});
