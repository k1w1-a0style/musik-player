import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import GlassCard from '../GlassCard';

let mockAppearance: 'dark' | 'light' = 'dark';

const mockAppTheme = {
  palette: {
    backgroundDeep: '#030406',
    surfaceGlass: 'rgba(18, 20, 26, 0.76)',
    border: 'rgba(255, 255, 255, 0.08)',
    primary: '#D8DEE8',
    primaryGlow: 'rgba(216, 222, 232, 0.12)',
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    theme: mockAppTheme,
    appearance: mockAppearance,
    skin: 'graphite',
    isHydrated: true,
    setAppearance: jest.fn(),
    setSkin: jest.fn(),
  }),
}));

jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

describe('GlassCard', () => {
  beforeEach(() => {
    mockAppearance = 'dark';
  });

  test('renders children', () => {
    const { getByText } = render(
      <GlassCard testID="glass-card">
        <Text>Inhalt</Text>
      </GlassCard>,
    );

    expect(getByText('Inhalt')).toBeTruthy();
  });

  test('uses app theme chrome', () => {
    const { getByTestId } = render(
      <GlassCard testID="glass-card">
        <Text>Inhalt</Text>
      </GlassCard>,
    );

    const styleText = JSON.stringify(getByTestId('glass-card').props.style);
    expect(styleText).toContain(mockAppTheme.palette.surfaceGlass);
    expect(styleText).toContain(mockAppTheme.palette.border);
  });

  test('uses app theme primary color for glow', () => {
    const { getByTestId } = render(
      <GlassCard testID="glass-card" glow>
        <Text>Inhalt</Text>
      </GlassCard>,
    );

    const styleText = JSON.stringify(getByTestId('glass-card').props.style);
    expect(styleText).toContain(mockAppTheme.palette.primary);
  });
});
