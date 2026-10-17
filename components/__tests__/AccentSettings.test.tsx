import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Animated, Text } from 'react-native';
import { StyleSheet } from 'react-native';
import { PlayerPresentationProvider } from '../../contexts/PlayerPresentationContext';
import AccentSettings from '../AccentSettings';
import CrossfadeLayers from '../CrossfadeLayers';
import { AccentPreferencesProvider } from '../../contexts/AccentPreferencesContext';
import { AppThemeProvider, useAppTheme } from '../../contexts/AppThemeContext';
import { storage } from '../../utils/storage';
import { ACCENT_IDS } from '../../utils/accentPreferences';

jest.mock('../../utils/storage', () => ({ storage: { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(true),
  getAppAppearance: jest.fn().mockResolvedValue('dark'), getAppThemeSkin: jest.fn().mockResolvedValue('graphite') } }));
const ThemeProbe = () => <Text testID="app-primary">{useAppTheme().theme.palette.primary}</Text>;
const settings = () => <AccentPreferencesProvider><PlayerPresentationProvider><AppThemeProvider><AccentSettings /><ThemeProbe /></AppThemeProvider></PlayerPresentationProvider></AccentPreferencesProvider>;
beforeEach(() => { jest.clearAllMocks(); (storage.get as jest.Mock).mockResolvedValue(null); });

test('app, player and instant settings preview immediately and persist independently across remount', async () => {
  const view = render(settings());
  await waitFor(() => expect(view.getByTestId('settings-appAccent-red').props.accessibilityState.disabled).toBe(false));
  fireEvent.press(view.getByTestId('settings-color-target-playerAccent'));
  for (const id of ACCENT_IDS) expect(view.getByTestId(`settings-playerAccent-${id}`)).toBeTruthy();
  fireEvent.press(view.getByTestId('settings-color-target-appAccent'));
  const before = view.getByTestId('app-primary').props.children;
  fireEvent.press(view.getByTestId('settings-appAccent-red'));
  const appColor = view.getByTestId('app-primary').props.children;
  expect(appColor).not.toBe(before);
  fireEvent.press(view.getByTestId('settings-color-target-playerAccent'));
  fireEvent.press(view.getByTestId('settings-playerAccent-cyan'));
  expect(view.getByTestId('app-primary').props.children).toBe(appColor);
  fireEvent(view.getByTestId('settings-instant-colors'), 'valueChange', true);
  fireEvent.press(view.getByTestId('settings-color-target-appAccent'));
  expect(view.getByTestId('settings-appAccent-red').props.accessibilityState.checked).toBe(true);
  fireEvent.press(view.getByTestId('settings-color-target-playerAccent'));
  expect(view.getByTestId('settings-playerAccent-cyan').props.accessibilityState.checked).toBe(true);
  const saved = { appAccent: 'red', playerAccent: 'cyan', instantColors: true };
  await waitFor(() => expect(storage.set).toHaveBeenLastCalledWith('accentPreferencesV4', saved));
  view.unmount();
  (storage.get as jest.Mock).mockImplementation(async key => key === 'accentPreferencesV4' ? saved : null);
  const restored = render(settings());
  fireEvent.press(restored.getByTestId('settings-color-target-playerAccent'));
  await waitFor(() => expect(restored.getByTestId('settings-playerAccent-cyan').props.accessibilityState.checked).toBe(true));
  fireEvent.press(restored.getByTestId('settings-color-target-appAccent'));
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

test.each(['dark','light'] as const)('Neutral swatch equals the actually rendered %s theme after a different app accent',async appearance=>{
 for(const skin of ['graphite','minimal','neon-cover'] as const){
  (storage.getAppAppearance as jest.Mock).mockResolvedValue(appearance);
  (storage.getAppThemeSkin as jest.Mock).mockResolvedValue(skin);
  const view=render(settings());
  await waitFor(()=>expect(view.getByTestId('settings-appAccent-red').props.accessibilityState.disabled).toBe(false));
  fireEvent.press(view.getByTestId('settings-appAccent-red'));
  const preview=StyleSheet.flatten(view.getByTestId('settings-color-swatch-neutral').props.style).backgroundColor;
  fireEvent.press(view.getByTestId('settings-appAccent-neutral'));
  expect(view.getByTestId('app-primary').props.children).toBe(preview);
  await waitFor(()=>expect(storage.set).toHaveBeenCalled());view.unmount();
 }
});
test('waveform choice uses its original separate storage contract',async()=>{
 const view=render(settings());fireEvent.press(view.getByTestId('settings-color-target-waveform'));
 await waitFor(()=>expect(view.getByTestId('settings-waveform-accent-blue').props.accessibilityState.disabled).toBe(false));
 fireEvent.press(view.getByTestId('settings-waveform-accent-blue'));
 await waitFor(()=>expect(storage.set).toHaveBeenCalledWith('playerPresentationV3',{quiet:false,density:'standard',waveformAccent:'blue'}));
 expect(storage.set).not.toHaveBeenCalledWith('accentPreferencesV4',expect.anything());
});
