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

import { fireEvent, render } from '@testing-library/react-native';
import EqualizerPresetList from '../EqualizerPresetList';

test('renders presets and applies a preset', () => {
  const onApplyPreset = jest.fn();
  const { getByTestId, getByText } = render(<EqualizerPresetList eqPreset="flat" onApplyPreset={onApplyPreset} />);

  expect(getByText('Voreinstellungen')).toBeTruthy();
  fireEvent.press(getByTestId('equalizer-preset-bassBoost'));
  expect(onApplyPreset).toHaveBeenCalledWith('bassBoost');
});

test('renders custom state', () => {
  const { getByText, getByTestId } = render(<EqualizerPresetList eqPreset="custom" onApplyPreset={jest.fn()} />);

  expect(getByText('Benutzerdefiniert')).toBeTruthy();
  expect(getByTestId('equalizer-preset-custom')).toBeTruthy();
});

test('uses app theme colors for active and inactive presets', () => {
  const { getByTestId } = render(<EqualizerPresetList eqPreset="flat" onApplyPreset={jest.fn()} />);

  expect(JSON.stringify(getByTestId('equalizer-preset-flat').props.style)).toContain(mockAppTheme.palette.primary);
  expect(JSON.stringify(getByTestId('equalizer-preset-bassBoost').props.style)).toContain(mockAppTheme.palette.surface);
});
