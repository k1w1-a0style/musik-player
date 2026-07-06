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

import { render } from '@testing-library/react-native';
import EqualizerCurveChart from '../EqualizerCurveChart';

test('renders curve chart with app theme chrome', () => {
  const { getByTestId } = render(<EqualizerCurveChart curvePath="M0 40 L320 40" />);
  const styleText = JSON.stringify(getByTestId('equalizer-curve-chart').props.style);

  expect(styleText).toContain(mockAppTheme.palette.surface);
  expect(styleText).toContain(mockAppTheme.palette.border);
});
