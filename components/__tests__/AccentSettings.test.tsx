import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Animated, Text } from 'react-native';
import AccentSettings from '../AccentSettings';
import CrossfadeLayers from '../CrossfadeLayers';
import { AccentPreferencesProvider } from '../../contexts/AccentPreferencesContext';
import { AppThemeProvider, useAppTheme } from '../../contexts/AppThemeContext';
import { storage } from '../../utils/storage';
import { ACCENT_IDS } from '../../utils/accentPreferences';

jest.mock('../../utils/storage', () => ({ storage: { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(true),
  getAppAppearance: jest.fn().mockResolvedValue('dark'), getAppThemeSkin: jest.fn().mockResolvedValue('graphite') } }));
const ThemeProbe = () => <Text testID="app-primary">{useAppTheme().theme.palette.primary}</Text>;
const settings = () => <AccentPreferencesProvider><AppThemeProvider><AccentSettings /><ThemeProbe /></AppThemeProvider></AccentPreferencesProvider>;
beforeEach(() => { jest.clearAllMocks(); (storage.get as jest.Mock).mockResolvedValue(null); });

test('app, player and instant settings preview immediately and persist independently across remount', async () => {
  const view = render(settings());
  await waitFor(() => expect(view.getByTestId('settings-appAccent-red').props.accessibilityState.disabled).toBe(false));
  for (const id of ACCENT_IDS) expect(view.getByTestId(`settings-playerAccent-${id}`)).toBeTruthy();
  const before = view.getByTestId('app-primary').props.children;
  fireEvent.press(view.getByTestId('settings-appAccent-red'));
  const appColor = view.getByTestId('app-primary').props.children;
  expect(appColor).not.toBe(before);
  fireEvent.press(view.getByTestId('settings-playerAccent-cyan'));
  expect(view.getByTestId('app-primary').props.children).toBe(appColor);
  fireEvent(view.getByTestId('settings-instant-colors'), 'valueChange', true);
  expect(view.getByTestId('settings-appAccent-red').props.accessibilityState.checked).toBe(true);
  expect(view.getByTestId('settings-playerAccent-cyan').props.accessibilityState.checked).toBe(true);
  const saved = { appAccent: 'red', playerAccent: 'cyan', instantColors: true };
  await waitFor(() => expect(storage.set).toHaveBeenLastCalledWith('accentPreferencesV4', saved));
  view.unmount();
  (storage.get as jest.Mock).mockImplementation(async key => key === 'accentPreferencesV4' ? saved : null);
  const restored = render(settings());
  await waitFor(() => expect(restored.getByTestId('settings-playerAccent-cyan').props.accessibilityState.checked).toBe(true));
  expect(restored.getByTestId('settings-appAccent-red').props.accessibilityState.checked).toBe(true);
  expect(restored.getByTestId('settings-instant-colors').props.value).toBe(true);
});

test('the instant-colors switch stops generic layer animations immediately', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  const content = (color: string) => <AccentPreferencesProvider><AppThemeProvider>
    <AccentSettings /><CrossfadeLayers value={color} valueKey={color} testID="instant-layers"
      renderLayer={value => <Text>{value}</Text>} />
  </AppThemeProvider></AccentPreferencesProvider>;
  const view = render(content('#112233'));
  await waitFor(() => expect(view.getByTestId('settings-appAccent-red').props.accessibilityState.disabled).toBe(false));
  fireEvent(view.getByTestId('settings-instant-colors'), 'valueChange', true);
  timing.mockClear(); view.rerender(content('#223344'));
  expect(timing).not.toHaveBeenCalled();
  expect(view.queryByTestId('instant-layers-outgoing', { includeHiddenElements: true })).toBeNull();
  await waitFor(() => expect(storage.set).toHaveBeenCalled());
  timing.mockRestore();
});
