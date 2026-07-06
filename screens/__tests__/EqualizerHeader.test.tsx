import React from 'react';

const mockAppTheme = {
  palette: {
    surface: '#111318',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(210, 218, 230, 0.28)',
    primary: '#D8DEE8',
    primaryDark: '#87909E',
    primaryGlow: 'rgba(216, 222, 232, 0.12)',
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
    theme: mockAppTheme,
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: jest.fn(),
    setSkin: jest.fn(),
  }),
}));

import { Switch } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import EqualizerHeader from '../EqualizerHeader';

test('renders header and toggles enabled state', () => {
  const onToggleEnabled = jest.fn();
  const { getByText, UNSAFE_getByType } = render(<EqualizerHeader eqEnabled={false} onToggleEnabled={onToggleEnabled} />);

  expect(getByText('SOUND')).toBeTruthy();
  expect(getByText('Equalizer')).toBeTruthy();

  fireEvent(UNSAFE_getByType(Switch), 'valueChange', true);
  expect(onToggleEnabled).toHaveBeenCalledWith(true);
});

test('uses app theme colors', () => {
  const { getByText } = render(<EqualizerHeader eqEnabled={false} onToggleEnabled={jest.fn()} />);

  expect(JSON.stringify(getByText('SOUND').props.style)).toContain(mockAppTheme.palette.primary);
  expect(JSON.stringify(getByText('Equalizer').props.style)).toContain(mockAppTheme.palette.text.primary);
});
