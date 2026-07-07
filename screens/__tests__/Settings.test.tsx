import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import Settings from '../Settings';
import {
  APP_APPEARANCES,
  APP_THEME_SKINS,
  getAppTheme,
  type AppAppearance,
  type AppTheme,
  type AppThemeSkin,
} from '../../utils/appTheme';

const mockSetAppearance = jest.fn();
const mockSetSkin = jest.fn();
let mockAppearance: AppAppearance = 'dark';
let mockSkin: AppThemeSkin = 'graphite';
let mockTheme: AppTheme = getAppTheme(mockAppearance, mockSkin);

const setMockTheme = (appearance: AppAppearance, skin: AppThemeSkin): AppTheme => {
  mockAppearance = appearance;
  mockSkin = skin;
  mockTheme = getAppTheme(appearance, skin);
  return mockTheme;
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    appearance: mockAppearance,
    skin: mockSkin,
    theme: mockTheme,
    isHydrated: true,
    setAppearance: mockSetAppearance,
    setSkin: mockSetSkin,
  }),
}));

describe('Settings', () => {
  beforeEach(() => {
    mockSetAppearance.mockClear();
    mockSetSkin.mockClear();
    setMockTheme('dark', 'graphite');
  });

  test('renders appearance and skin controls', () => {
    const { getByTestId, getByText } = render(<Settings />);

    expect(getByTestId('settings-screen')).toBeTruthy();
    expect(getByText('Hell / Dunkel')).toBeTruthy();
    expect(getByText('Oberfläche')).toBeTruthy();
    for (const appearance of APP_APPEARANCES) {
      expect(getByTestId(`settings-appearance-${appearance}`)).toBeTruthy();
    }
    for (const skin of APP_THEME_SKINS) {
      expect(getByTestId(`settings-skin-${skin}`)).toBeTruthy();
    }
  });

  test('marks the current appearance and skin controls as selected', () => {
    setMockTheme('light', 'minimal');

    const { getByTestId } = render(<Settings />);

    expect(getByTestId('settings-appearance-dark').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('settings-appearance-light').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('settings-skin-graphite').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('settings-skin-minimal').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('settings-skin-neon-cover').props.accessibilityState.selected).toBe(false);
  });

  test('styles selected and unselected controls from the active theme palette', () => {
    const activeTheme = setMockTheme('light', 'neon-cover');

    const { getByTestId } = render(<Settings />);
    const selectedAppearanceStyle = StyleSheet.flatten(getByTestId('settings-appearance-light').props.style);
    const unselectedAppearanceStyle = StyleSheet.flatten(getByTestId('settings-appearance-dark').props.style);
    const selectedSkinStyle = StyleSheet.flatten(getByTestId('settings-skin-neon-cover').props.style);
    const unselectedSkinStyle = StyleSheet.flatten(getByTestId('settings-skin-minimal').props.style);

    expect(selectedAppearanceStyle.backgroundColor).toBe(activeTheme.palette.surfaceElevated);
    expect(selectedAppearanceStyle.borderColor).toBe(activeTheme.palette.primary);
    expect(unselectedAppearanceStyle.backgroundColor).toBe(activeTheme.palette.surface);
    expect(unselectedAppearanceStyle.borderColor).toBe(activeTheme.palette.border);
    expect(selectedSkinStyle.backgroundColor).toBe(activeTheme.palette.surfaceElevated);
    expect(selectedSkinStyle.borderColor).toBe(activeTheme.palette.primary);
    expect(unselectedSkinStyle.backgroundColor).toBe(activeTheme.palette.surface);
    expect(unselectedSkinStyle.borderColor).toBe(activeTheme.palette.border);
  });

  test('changes appearance and skin through settings controls', () => {
    const { getByTestId } = render(<Settings />);

    fireEvent.press(getByTestId('settings-appearance-light'));
    fireEvent.press(getByTestId('settings-skin-neon-cover'));

    expect(mockSetAppearance).toHaveBeenCalledWith('light');
    expect(mockSetSkin).toHaveBeenCalledWith('neon-cover');
  });

  test('shows a theme preview for the selected theme', () => {
    setMockTheme('light', 'minimal');

    const { getByTestId, getByText } = render(<Settings />);

    expect(getByTestId('settings-theme-preview')).toBeTruthy();
    expect(getByText('Minimal Light')).toBeTruthy();
  });

  test('styles the screen and preview from the current theme values', () => {
    const activeTheme = setMockTheme('light', 'neon-cover');

    const { getByTestId, getByText } = render(<Settings />);
    const screenStyle = StyleSheet.flatten(getByTestId('settings-screen').props.style);
    const previewStyle = StyleSheet.flatten(getByTestId('settings-theme-preview').props.style);

    expect(getByText(activeTheme.label)).toBeTruthy();
    expect(screenStyle.backgroundColor).toBe(activeTheme.palette.background);
    expect(previewStyle.backgroundColor).toBe(activeTheme.palette.surfaceGlass);
    expect(previewStyle.borderColor).toBe(activeTheme.palette.borderStrong);
  });
});
