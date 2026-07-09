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
import {
  NOW_PLAYING_CONTROLS_MODES,
  type NowPlayingControlsMode,
} from '../../utils/nowPlayingControlsMode';

const mockSetAppearance = jest.fn();
const mockSetSkin = jest.fn();
const mockSetNowPlayingControlsMode = jest.fn();
let mockAppearance: AppAppearance = 'dark';
let mockSkin: AppThemeSkin = 'graphite';
let mockNowPlayingControlsMode: NowPlayingControlsMode = 'buttons';
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

jest.mock('../../hooks/useNowPlayingControlsMode', () => ({
  useNowPlayingControlsMode: () => ({
    mode: mockNowPlayingControlsMode,
    isHydrated: true,
    setMode: mockSetNowPlayingControlsMode,
  }),
}));

describe('Settings', () => {
  beforeEach(() => {
    mockSetAppearance.mockClear();
    mockSetSkin.mockClear();
    mockSetNowPlayingControlsMode.mockClear();
    mockNowPlayingControlsMode = 'buttons';
    setMockTheme('dark', 'graphite');
  });

  test('renders appearance, skin, and player mode controls', () => {
    const { getByTestId, getByText } = render(<Settings />);

    expect(getByTestId('settings-screen')).toBeTruthy();
    expect(getByText('Hell / Dunkel')).toBeTruthy();
    expect(getByText('Oberfläche')).toBeTruthy();
    expect(getByText('Player-Bedienung')).toBeTruthy();
    for (const appearance of APP_APPEARANCES) {
      expect(getByTestId(`settings-appearance-${appearance}`)).toBeTruthy();
    }
    for (const skin of APP_THEME_SKINS) {
      expect(getByTestId(`settings-skin-${skin}`)).toBeTruthy();
    }
    for (const mode of NOW_PLAYING_CONTROLS_MODES) {
      expect(getByTestId(`settings-now-playing-controls-${mode}`)).toBeTruthy();
    }
  });

  test('marks the current appearance, skin, and player mode controls as selected', () => {
    setMockTheme('light', 'minimal');
    mockNowPlayingControlsMode = 'coverSwipe';

    const { getByTestId } = render(<Settings />);

    expect(getByTestId('settings-appearance-dark').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('settings-appearance-light').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('settings-skin-graphite').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('settings-skin-minimal').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('settings-skin-neon-cover').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('settings-now-playing-controls-buttons').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('settings-now-playing-controls-coverSwipe').props.accessibilityState.selected).toBe(true);
  });

  test('styles selected and unselected controls from the active theme palette and tokens', () => {
    const activeTheme = setMockTheme('light', 'neon-cover');
    mockNowPlayingControlsMode = 'coverSwipe';

    const { getByTestId, getByText } = render(<Settings />);
    const selectedAppearanceStyle = StyleSheet.flatten(getByTestId('settings-appearance-light').props.style);
    const unselectedAppearanceStyle = StyleSheet.flatten(getByTestId('settings-appearance-dark').props.style);
    const selectedSkinStyle = StyleSheet.flatten(getByTestId('settings-skin-neon-cover').props.style);
    const unselectedSkinStyle = StyleSheet.flatten(getByTestId('settings-skin-minimal').props.style);
    const selectedModeStyle = StyleSheet.flatten(getByTestId('settings-now-playing-controls-coverSwipe').props.style);
    const unselectedModeStyle = StyleSheet.flatten(getByTestId('settings-now-playing-controls-buttons').props.style);
    const headerStyle = StyleSheet.flatten(getByText('Einstellungen').props.style);

    expect(selectedAppearanceStyle.backgroundColor).toBe(activeTheme.palette.surfaceElevated);
    expect(selectedAppearanceStyle.borderColor).toBe(activeTheme.palette.primary);
    expect(selectedAppearanceStyle.borderRadius).toBe(activeTheme.tokens.radii.card);
    expect(selectedAppearanceStyle.padding).toBe(activeTheme.tokens.spacing.md);
    expect(selectedAppearanceStyle.gap).toBe(activeTheme.tokens.spacing.xs);
    expect(unselectedAppearanceStyle.backgroundColor).toBe(activeTheme.palette.surface);
    expect(unselectedAppearanceStyle.borderColor).toBe(activeTheme.palette.border);
    expect(selectedSkinStyle.backgroundColor).toBe(activeTheme.palette.surfaceElevated);
    expect(selectedSkinStyle.borderColor).toBe(activeTheme.palette.primary);
    expect(unselectedSkinStyle.backgroundColor).toBe(activeTheme.palette.surface);
    expect(unselectedSkinStyle.borderColor).toBe(activeTheme.palette.border);
    expect(selectedModeStyle.backgroundColor).toBe(activeTheme.palette.surfaceElevated);
    expect(selectedModeStyle.borderColor).toBe(activeTheme.palette.primary);
    expect(unselectedModeStyle.backgroundColor).toBe(activeTheme.palette.surface);
    expect(unselectedModeStyle.borderColor).toBe(activeTheme.palette.border);
    expect(headerStyle.fontFamily).toBe(activeTheme.tokens.fonts.heading);
  });

  test('changes appearance, skin, and player mode through settings controls', () => {
    const { getByTestId } = render(<Settings />);

    fireEvent.press(getByTestId('settings-appearance-light'));
    fireEvent.press(getByTestId('settings-skin-neon-cover'));
    fireEvent.press(getByTestId('settings-now-playing-controls-coverSwipe'));

    expect(mockSetAppearance).toHaveBeenCalledWith('light');
    expect(mockSetSkin).toHaveBeenCalledWith('neon-cover');
    expect(mockSetNowPlayingControlsMode).toHaveBeenCalledWith('coverSwipe');
  });

  test('shows a theme preview for the selected theme', () => {
    setMockTheme('light', 'minimal');

    const { getByTestId, getByText } = render(<Settings />);

    expect(getByTestId('settings-theme-preview')).toBeTruthy();
    expect(getByText('Minimal Light')).toBeTruthy();
  });

  test('styles the screen, scroll content, and preview from the current theme values', () => {
    const activeTheme = setMockTheme('light', 'neon-cover');

    const { getByTestId, getByText } = render(<Settings />);
    const screenStyle = StyleSheet.flatten(getByTestId('settings-screen').props.style);
    const scrollContentStyle = StyleSheet.flatten(getByTestId('settings-scroll').props.contentContainerStyle);
    const previewStyle = StyleSheet.flatten(getByTestId('settings-theme-preview').props.style);

    expect(getByText(activeTheme.label)).toBeTruthy();
    expect(screenStyle.backgroundColor).toBe(activeTheme.palette.background);
    expect(scrollContentStyle.padding).toBe(activeTheme.tokens.spacing.md);
    expect(scrollContentStyle.gap).toBe(activeTheme.tokens.spacing.md);
    expect(previewStyle.backgroundColor).toBe(activeTheme.palette.surfaceGlass);
    expect(previewStyle.borderColor).toBe(activeTheme.palette.borderStrong);
    expect(previewStyle.borderRadius).toBe(activeTheme.tokens.radii.elevatedCard);
    expect(previewStyle.padding).toBe(activeTheme.tokens.spacing.md);
    expect(previewStyle.gap).toBe(activeTheme.tokens.spacing.md);
  });
});
