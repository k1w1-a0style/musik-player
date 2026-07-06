import React from 'react';

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
});

test('renders custom title', () => {
  const { getByText } = render(<LibraryTopBar title="Meine Musik" onToggleSearch={jest.fn()} onOpenMenu={jest.fn()} />);

  expect(getByText('Meine Musik')).toBeTruthy();
});

test('calls onToggleSearch when search button is pressed', () => {
  const onToggleSearch = jest.fn();
  const { getByTestId } = render(<LibraryTopBar onToggleSearch={onToggleSearch} onOpenMenu={jest.fn()} />);

  fireEvent.press(getByTestId('library-toggle-search'));

  expect(onToggleSearch).toHaveBeenCalledTimes(1);
});

test('calls onOpenMenu when menu button is pressed', () => {
  const onOpenMenu = jest.fn();
  const { getByTestId } = render(<LibraryTopBar onToggleSearch={jest.fn()} onOpenMenu={onOpenMenu} />);

  fireEvent.press(getByTestId('library-open-menu'));

  expect(onOpenMenu).toHaveBeenCalledTimes(1);
});


test('uses app theme text color', () => {
  const { getByText } = render(<LibraryTopBar onToggleSearch={jest.fn()} onOpenMenu={jest.fn()} />);
  expect(JSON.stringify(getByText('K1W1 Music').props.style)).toContain(mockAppTheme.palette.text.primary);
});
