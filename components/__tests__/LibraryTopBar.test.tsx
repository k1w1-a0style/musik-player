import React from 'react';
import { StyleSheet, Text } from 'react-native';

const mockAppTheme = {
  palette: {
    backgroundDeep: '#030406',
    surfaceElevated: '#191B21',
    border: 'rgba(255, 255, 255, 0.08)',
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

import { fireEvent, render } from '@testing-library/react-native';
import LibraryTopBar from '../LibraryTopBar';

test('renders default title', () => {
  const { getByText } = render(<LibraryTopBar onToggleSearch={jest.fn()} onOpenMenu={jest.fn()} />);

  expect(getByText('K1W1 Music')).toBeTruthy();
  expect(getByText('K1W1 Music').props.numberOfLines).toBe(2);
});

test('renders custom title', () => {
  const { getByText } = render(<LibraryTopBar title="Meine Musik" onToggleSearch={jest.fn()} onOpenMenu={jest.fn()} />);

  expect(getByText('Meine Musik')).toBeTruthy();
});

test('places the optional activity directly after the title in the brand row', () => {
  const view = render(<LibraryTopBar activity={<Text testID="test-library-activity">!</Text>}
    onToggleSearch={jest.fn()} onOpenMenu={jest.fn()} />);
  const brand = view.getByTestId('library-brand-title');
  expect(StyleSheet.flatten(brand.props.style)).toMatchObject({ flexDirection: 'row', alignItems: 'center' });
  expect(brand.children.map(child => typeof child === 'string' ? child : child.props.testID ?? child.props.children))
    .toEqual(['K1W1 Music', 'test-library-activity']);
});

test('calls onToggleSearch when search button is pressed', () => {
  const onToggleSearch = jest.fn();
  const { getByTestId } = render(<LibraryTopBar onToggleSearch={onToggleSearch} onOpenMenu={jest.fn()} />);

  fireEvent.press(getByTestId('library-toggle-search'));

  expect(onToggleSearch).toHaveBeenCalledTimes(1);
});

test('announces the destructive close action while search is open', () => {
  const { getByTestId } = render(<LibraryTopBar searchOpen onToggleSearch={jest.fn()} onOpenMenu={jest.fn()} />);

  expect(getByTestId('library-toggle-search').props.accessibilityLabel)
    .toBe('Suche schließen und Filter löschen');
});

test('calls onOpenMenu when menu button is pressed', () => {
  const onOpenMenu = jest.fn();
  const { getByTestId } = render(<LibraryTopBar onToggleSearch={jest.fn()} onOpenMenu={onOpenMenu} />);

  fireEvent.press(getByTestId('library-open-menu'));

  expect(onOpenMenu).toHaveBeenCalledTimes(1);
});

test('gives both icon buttons a generous touch target', () => {
  const { getByTestId } = render(<LibraryTopBar onToggleSearch={jest.fn()} onOpenMenu={jest.fn()} />);

  expect(getByTestId('library-toggle-search').props.hitSlop).toBe(8);
  expect(getByTestId('library-open-menu').props.hitSlop).toBe(8);
});


test('uses app theme text color', () => {
  const { getByText } = render(<LibraryTopBar onToggleSearch={jest.fn()} onOpenMenu={jest.fn()} />);
  expect(JSON.stringify(getByText('K1W1 Music').props.style)).toContain(mockAppTheme.palette.text.primary);
});
