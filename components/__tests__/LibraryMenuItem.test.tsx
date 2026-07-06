import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryMenuItem from '../LibraryMenuItem';

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: jest.fn(),
    setSkin: jest.fn(),
    theme: {
      palette: {
        background: '#07090C',
        surface: '#101218',
        surfaceElevated: '#191B21',
        surfaceGlass: 'rgba(18, 20, 26, 0.76)',
        border: 'rgba(255, 255, 255, 0.08)',
        borderStrong: 'rgba(210, 218, 230, 0.28)',
        primary: '#D8DEE8',
        primaryDark: '#87909E',
        primaryGlow: 'rgba(216, 222, 232, 0.12)',
        error: '#FF6F8A',
        text: {
          primary: '#F4F5F7',
          secondary: 'rgba(244, 245, 247, 0.70)',
          muted: 'rgba(244, 245, 247, 0.42)',
          onPrimary: '#07090C',
        },
      },
      gradients: {
        background: ['#07090C', '#101218'],
        nowPlaying: ['#07090C', '#191B21'],
      },
    },
  }),
}));

test('renders label and calls onPress', () => {
  const onPress = jest.fn();
  const { getByText, getByTestId } = render(<LibraryMenuItem label="Importieren / Rescan" onPress={onPress} />);

  expect(getByText('Importieren / Rescan')).toBeTruthy();
  fireEvent.press(getByTestId('library-menu-item-importieren-rescan'));

  expect(onPress).toHaveBeenCalledTimes(1);
});

test('does not call onPress when disabled', () => {
  const onPress = jest.fn();
  const { getByTestId } = render(<LibraryMenuItem label="Metadaten aktualisieren" onPress={onPress} disabled />);

  const item = getByTestId('library-menu-item-metadaten-aktualisieren');
  expect(item.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(item);

  expect(onPress).not.toHaveBeenCalled();
});

test('applies muted text style', () => {
  const { getByText } = render(<LibraryMenuItem label="Aktive Scan-Ordner: 1" onPress={jest.fn()} muted />);

  const textStyle = getByText('Aktive Scan-Ordner: 1').props.style;
  expect(textStyle).toEqual(expect.arrayContaining([expect.objectContaining({ fontSize: 14 })]));
});
