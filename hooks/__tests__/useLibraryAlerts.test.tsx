import { Alert, Linking } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { musicAccessButtons, useLibraryAlerts } from '../useLibraryAlerts';

afterEach(() => jest.restoreAllMocks());

describe('useLibraryAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows native alert with title and message', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { result } = renderHook(() => useLibraryAlerts());

    act(() => {
      result.current.showAlert({ title: 'Titel', message: 'Nachricht' });
    });

    expect(alertSpy).toHaveBeenCalledWith('Titel', 'Nachricht');
  });

  test('passes actionable settings and SAF folder choices to the native alert', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    const selectFolder = jest.fn();
    const buttons = musicAccessButtons(selectFolder);
    const { result } = renderHook(() => useLibraryAlerts());
    act(() => result.current.showAlert({ title: 'Musikzugriff', message: 'Nur lesen', buttons }));
    expect(alert).toHaveBeenCalledWith('Musikzugriff', 'Nur lesen', buttons);
    buttons.find(button => button.text === 'Musikordner auswählen')!.onPress!();
    expect(selectFolder).toHaveBeenCalledTimes(1);
    await act(async () => buttons.find(button => button.text === 'App-Einstellungen')!.onPress!());
    expect(settings).toHaveBeenCalledTimes(1);
  });

  test('explains how to open settings manually if the Android settings intent fails', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(Linking, 'openSettings').mockRejectedValue(new Error('No settings activity'));
    await act(async () => musicAccessButtons().find(button => button.text === 'App-Einstellungen')!.onPress!());
    expect(alert).toHaveBeenCalledWith('Einstellungen öffnen', expect.stringContaining('Android-Einstellungen'));
  });
});
