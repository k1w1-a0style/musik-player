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
import LibraryTabs from '../LibraryTabs';

test('renders library tabs', () => {
  const { getByText } = render(<LibraryTabs activeTab="tracks" onChangeTab={jest.fn()} />);

  expect(getByText('Titel')).toBeTruthy();
  expect(getByText('Alben')).toBeTruthy();
  expect(getByText('Künstler')).toBeTruthy();
});

test('marks active tab as selected', () => {
  const { getByTestId } = render(<LibraryTabs activeTab="albums" onChangeTab={jest.fn()} />);

  expect(getByTestId('library-tab-albums').props.accessibilityState.selected).toBe(true);
  expect(getByTestId('library-tab-tracks').props.accessibilityState.selected).toBe(false);
});

test('calls onChangeTab when tab is pressed', () => {
  const onChangeTab = jest.fn();
  const { getByTestId } = render(<LibraryTabs activeTab="tracks" onChangeTab={onChangeTab} />);

  fireEvent.press(getByTestId('library-tab-playlists'));

  expect(onChangeTab).toHaveBeenCalledWith('playlists');
});


test('uses app theme colors for active and muted tabs', () => {
  const { getByText } = render(<LibraryTabs activeTab="tracks" onChangeTab={jest.fn()} />);

  expect(JSON.stringify(getByText('Titel').props.style)).toContain(mockAppTheme.palette.text.primary);
  expect(JSON.stringify(getByText('Alben').props.style)).toContain(mockAppTheme.palette.text.secondary);
});
