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
import EqualizerStatusCard from '../EqualizerStatusCard';

jest.mock('../../components/GlassCard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

test('renders UI-only status when native EQ is unavailable', () => {
  const { getByText } = render(<EqualizerStatusCard eqNative={null} />);

  expect(getByText('○ NUR UI')).toBeTruthy();
  expect(getByText(/Native Equalizer-API nicht verfügbar/)).toBeTruthy();
});

test('renders available native EQ status', () => {
  const { getByText } = render(<EqualizerStatusCard eqNative={{ available: true, bands: [{ centerFreqHz: 1000 }] } as never} />);

  expect(getByText('● EXPERIMENTELL')).toBeTruthy();
  expect(getByText(/1\.0k/)).toBeTruthy();
});

test('uses app theme colors', () => {
  const { getByText } = render(<EqualizerStatusCard eqNative={null} />);

  expect(JSON.stringify(getByText('○ NUR UI').props.style)).toContain(mockAppTheme.palette.warning);
  expect(JSON.stringify(getByText(/Native Equalizer-API nicht verfügbar/).props.style)).toContain(mockAppTheme.palette.text.secondary);
});
