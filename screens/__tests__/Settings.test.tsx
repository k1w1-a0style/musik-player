import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import Settings from '../Settings';
import type { AppAppearance, AppTheme, AppThemeSkin } from '../../utils/appTheme';

const mockSetAppearance = jest.fn();
const mockSetSkin = jest.fn();
let mockAppearance: AppAppearance = 'dark';
let mockSkin: AppThemeSkin = 'graphite';

const mockBuildTheme = (): AppTheme => {
  const dark = mockAppearance === 'dark';
  const skinLabel = mockSkin === 'neon-cover' ? 'Neon Cover' : mockSkin === 'minimal' ? 'Minimal' : 'Graphite';
  const appearanceLabel = dark ? 'Dark' : 'Light';

  return {
    id: `${mockSkin}-${mockAppearance}`,
    appearance: mockAppearance,
    skin: mockSkin,
    label: `${skinLabel} ${appearanceLabel}`,
    navigationDark: dark,
    statusBarStyle: dark ? 'light-content' : 'dark-content',
    palette: {
      background: dark ? '#08090B' : '#F4F5F7',
      backgroundDeep: dark ? '#030406' : '#E8EAEE',
      surface: dark ? '#111318' : '#FFFFFF',
      surfaceElevated: dark ? '#191B21' : '#EEF1F5',
      surfaceGlass: dark ? 'rgba(18, 20, 26, 0.76)' : 'rgba(255, 255, 255, 0.82)',
      card: dark ? '#111318' : '#FFFFFF',
      cardElevated: dark ? '#1A1D24' : '#F0F2F6',
      border: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(12, 16, 22, 0.10)',
      borderStrong: dark ? 'rgba(210, 218, 230, 0.28)' : 'rgba(12, 16, 22, 0.20)',
      primary: dark ? '#D8DEE8' : '#232832',
      primaryDark: dark ? '#87909E' : '#515B6A',
      primaryGlow: dark ? 'rgba(216, 222, 232, 0.12)' : 'rgba(35, 40, 50, 0.10)',
      accent: dark ? '#BFC7D4' : '#4F5B6B',
      accentGlow: dark ? 'rgba(191, 199, 212, 0.10)' : 'rgba(79, 91, 107, 0.12)',
      success: dark ? '#D8DEE8' : '#2E7D50',
      error: dark ? '#FF6F8A' : '#C83A59',
      warning: dark ? '#FFCA77' : '#A76519',
      text: {
        primary: dark ? '#F4F5F7' : '#101319',
        secondary: dark ? 'rgba(244, 245, 247, 0.70)' : 'rgba(16, 19, 25, 0.68)',
        muted: dark ? 'rgba(244, 245, 247, 0.42)' : 'rgba(16, 19, 25, 0.42)',
        onPrimary: dark ? '#07090C' : '#FFFFFF',
      },
    },
    gradients: {
      background: dark ? ['#030406', '#08090B', '#0D1014'] : ['#E8EAEE', '#F4F5F7', '#FFFFFF'],
      nowPlaying: dark ? ['#030406', '#08090B', '#0D1014'] : ['#E8EAEE', '#F4F5F7', '#FFFFFF'],
    },
  };
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    appearance: mockAppearance,
    skin: mockSkin,
    theme: mockBuildTheme(),
    isHydrated: true,
    setAppearance: mockSetAppearance,
    setSkin: mockSetSkin,
  }),
}));

describe('Settings', () => {
  beforeEach(() => {
    mockSetAppearance.mockClear();
    mockSetSkin.mockClear();
    mockAppearance = 'dark';
    mockSkin = 'graphite';
  });

  test('renders appearance and skin controls', () => {
    const { getByTestId, getByText } = render(<Settings />);

    expect(getByTestId('settings-screen')).toBeTruthy();
    expect(getByText('Hell / Dunkel')).toBeTruthy();
    expect(getByText('Oberfläche')).toBeTruthy();
    expect(getByTestId('settings-appearance-dark').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('settings-skin-graphite').props.accessibilityState.selected).toBe(true);
  });

  test('changes appearance and skin through settings controls', () => {
    const { getByTestId } = render(<Settings />);

    fireEvent.press(getByTestId('settings-appearance-light'));
    fireEvent.press(getByTestId('settings-skin-neon-cover'));

    expect(mockSetAppearance).toHaveBeenCalledWith('light');
    expect(mockSetSkin).toHaveBeenCalledWith('neon-cover');
  });

  test('shows a theme preview for the selected theme', () => {
    mockAppearance = 'light';
    mockSkin = 'minimal';

    const { getByTestId, getByText } = render(<Settings />);

    expect(getByTestId('settings-theme-preview')).toBeTruthy();
    expect(getByText('Minimal Light')).toBeTruthy();
  });
});
