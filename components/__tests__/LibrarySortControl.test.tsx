import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibrarySortControl from '../LibrarySortControl';

const mockAppTheme = {
  palette: {
    surface: '#101218',
    surfaceElevated: '#191B21',
    surfaceGlass: 'rgba(18, 20, 26, 0.76)',
    border: 'rgba(255, 255, 255, 0.08)',
    primary: '#D8DEE8',
    primaryDark: '#87909E',
    primaryGlow: 'rgba(216, 222, 232, 0.12)',
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

describe('LibrarySortControl', () => {
  test('shows the current sort label', () => {
    const { getByTestId } = render(<LibrarySortControl mode="year" onSelect={jest.fn()} />);
    expect(getByTestId('library-sort-control-label').props.children).toBe('Jahr');
  });

  test('opens the menu and selects a sort mode', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<LibrarySortControl mode="alphabet" onSelect={onSelect} />);

    fireEvent.press(getByTestId('library-sort-control'));
    fireEvent.press(getByTestId('library-sort-option-year'));

    expect(onSelect).toHaveBeenCalledWith('year');
  });
});
