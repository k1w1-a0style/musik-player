import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import Settings from '../Settings';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../types/navigation';
import {
  APP_APPEARANCES,
  APP_THEME_SKINS,
  getAppTheme,
  type AppAppearance,
  type AppTheme,
  type AppThemeSkin,
} from '../../utils/appTheme';
import {
  NOW_PLAYING_PLAYER_LAYOUTS,
  type NowPlayingPlayerLayout,
} from '../../utils/nowPlayingControlsMode';

const renderSettings = (navigation?: NativeStackNavigationProp<AppStackParamList,'Settings'>) => {
 const view=render(<Settings navigation={navigation}/>);
 for(const group of ['appearance','player','motion','library']) fireEvent.press(view.getByTestId(`settings-group-${group}`));
 return view;
};

const mockSetAppearance = jest.fn();
const mockSetBassPulse = jest.fn();
const mockSetSkin = jest.fn();
const mockSetNowPlayingPlayerLayout = jest.fn();
let mockAppearance: AppAppearance = 'dark';
let mockSkin: AppThemeSkin = 'graphite';
let mockNowPlayingPlayerLayout: NowPlayingPlayerLayout = 'classic';
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
    bassPulseEnabled: true, setBassPulseEnabled: mockSetBassPulse,
  }),
}));

jest.mock('../../hooks/useNowPlayingControlsMode', () => ({
  useNowPlayingControlsMode: () => ({
    mode: mockNowPlayingPlayerLayout,
    isHydrated: true,
    setMode: mockSetNowPlayingPlayerLayout,
  }),
}));

describe('Settings', () => {
  test('opens the separate collection cleaner from its settings entry', () => {
    const navigate = jest.fn();
    const navigation = { navigate } as unknown as NativeStackNavigationProp<AppStackParamList, 'Settings'>;
    const screen = renderSettings(navigation);
    fireEvent.press(screen.getByTestId('settings-tag-cleaner'));
    expect(navigate).toHaveBeenCalledWith('TagCleaner');
  });
  beforeEach(() => {
    mockSetAppearance.mockClear();
    mockSetSkin.mockClear();
    mockSetNowPlayingPlayerLayout.mockClear();
    mockNowPlayingPlayerLayout = 'classic';
    setMockTheme('dark', 'graphite');
  });

  test('renders appearance, skin, and player layout controls', () => {
    const { getByTestId, getByText } = renderSettings();

    expect(getByTestId('settings-screen')).toBeTruthy();
    expect(getByText('Hell / Dunkel')).toBeTruthy();
    expect(getByText('Oberfläche')).toBeTruthy();
    expect(getByText('Player-Ansicht')).toBeTruthy();
    for (const appearance of APP_APPEARANCES) {
      expect(getByTestId(`settings-appearance-${appearance}`)).toBeTruthy();
    }
    for (const skin of APP_THEME_SKINS) {
      expect(getByTestId(`settings-skin-${skin}`)).toBeTruthy();
    }
    for (const layout of NOW_PLAYING_PLAYER_LAYOUTS) {
      expect(getByTestId(`settings-player-layout-${layout}`)).toBeTruthy();
    }
  });

  test('marks the current appearance, skin, and player layout controls as selected', () => {
    setMockTheme('light', 'minimal');
    mockNowPlayingPlayerLayout = 'soundcloud';

    const { getByTestId } = renderSettings();

    expect(getByTestId('settings-appearance-dark').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('settings-appearance-light').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('settings-skin-graphite').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('settings-skin-minimal').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('settings-skin-neon-cover').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('settings-player-layout-classic').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('settings-player-layout-soundcloud').props.accessibilityState.selected).toBe(true);
  });

  test('styles selected and unselected controls from the active theme palette and tokens', () => {
    const activeTheme = setMockTheme('light', 'neon-cover');
    mockNowPlayingPlayerLayout = 'soundcloud';

    const { getByTestId } = renderSettings();
    const selectedAppearanceStyle = StyleSheet.flatten(getByTestId('settings-appearance-light').props.style);
    const unselectedAppearanceStyle = StyleSheet.flatten(getByTestId('settings-appearance-dark').props.style);
    const selectedSkinStyle = StyleSheet.flatten(getByTestId('settings-skin-neon-cover').props.style);
    const unselectedSkinStyle = StyleSheet.flatten(getByTestId('settings-skin-minimal').props.style);
    const selectedLayoutStyle = StyleSheet.flatten(getByTestId('settings-player-layout-soundcloud').props.style);
    const unselectedLayoutStyle = StyleSheet.flatten(getByTestId('settings-player-layout-classic').props.style);

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
    expect(selectedLayoutStyle.backgroundColor).toBe(activeTheme.palette.surfaceElevated);
    expect(selectedLayoutStyle.borderColor).toBe(activeTheme.palette.primary);
    expect(unselectedLayoutStyle.backgroundColor).toBe(activeTheme.palette.surface);
    expect(unselectedLayoutStyle.borderColor).toBe(activeTheme.palette.border);
  });

  test('changes appearance, skin, and player layout through settings controls', () => {
    const { getByTestId } = renderSettings();

    fireEvent.press(getByTestId('settings-appearance-light'));
    fireEvent.press(getByTestId('settings-skin-neon-cover'));
    fireEvent.press(getByTestId('settings-player-layout-soundcloud'));

    expect(mockSetAppearance).toHaveBeenCalledWith('light');
    expect(mockSetSkin).toHaveBeenCalledWith('neon-cover');
    expect(mockSetNowPlayingPlayerLayout).toHaveBeenCalledWith('soundcloud');
  });

  test('shows a theme preview for the selected theme', () => {
    setMockTheme('light', 'minimal');

    const { getByTestId, getByText } = renderSettings();

    expect(getByTestId('settings-theme-preview')).toBeTruthy();
    expect(getByText('Minimal Light')).toBeTruthy();
  });

  test('styles the screen, scroll content, and preview from the current theme values', () => {
    const activeTheme = setMockTheme('light', 'neon-cover');

    const { getByTestId, getByText } = renderSettings();
    const screenStyle = StyleSheet.flatten(getByTestId('settings-screen').props.style);
    const scrollContentStyle = StyleSheet.flatten(getByTestId('settings-scroll').props.contentContainerStyle);
    const previewStyle = StyleSheet.flatten(getByTestId('settings-theme-preview').props.style);

    expect(getByText(activeTheme.label)).toBeTruthy();
    expect(screenStyle.flex).toBe(1);
    expect(scrollContentStyle.padding).toBe(activeTheme.tokens.spacing.md);
    expect(scrollContentStyle.gap).toBe(activeTheme.tokens.spacing.md);
    expect(previewStyle.backgroundColor).toBe(activeTheme.palette.surfaceGlass);
    expect(previewStyle.borderColor).toBe(activeTheme.palette.borderStrong);
    expect(previewStyle.borderRadius).toBe(activeTheme.tokens.radii.elevatedCard);
    expect(previewStyle.padding).toBe(activeTheme.tokens.spacing.md);
    expect(previewStyle.gap).toBe(activeTheme.tokens.spacing.md);
  });
});


test('bass pulse can be switched off from Settings', () => {
  const view = renderSettings();
  expect(view.getByTestId('settings-cover-bass-pulse').props.value).toBe(true);
  fireEvent(view.getByTestId('settings-cover-bass-pulse'), 'valueChange', false);
  expect(mockSetBassPulse).toHaveBeenCalledWith(false);
});

test('starts with four compact groups and expands only the requested controls',()=>{
 const view=render(<Settings/>);
 expect(view.queryByTestId('settings-appAccent-red')).toBeNull();
 for(const group of ['appearance','player','motion','library'])expect(view.getByTestId(`settings-group-${group}`).props.accessibilityState.expanded).toBe(false);
 fireEvent.press(view.getByTestId('settings-group-motion'));
 expect(view.getByTestId('settings-cover-bass-pulse')).toBeTruthy();
 expect(view.queryByTestId('settings-appAccent-red')).toBeNull();
});
