import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import ResumeSettings from '../ResumeSettings';
import { PlaybackResumeProvider } from '../../contexts/PlaybackResumeContext';
import { storage } from '../../utils/storage';
import { getAppTheme } from '../../utils/appTheme';
const mockTheme = getAppTheme('dark', 'graphite');
jest.mock('../../contexts/AppThemeContext', () => ({ useAppTheme: () => ({ theme: mockTheme }) }));
jest.mock('../../utils/storage', () => ({ storage: { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(true) } }));
beforeEach(() => { jest.clearAllMocks(); (storage.get as jest.Mock).mockResolvedValue(null); (storage.set as jest.Mock).mockResolvedValue(true); });
test('starts Off, persists the switch and loads its explicit On choice on restart', async () => {
  const view = render(<PlaybackResumeProvider><ResumeSettings /></PlaybackResumeProvider>);
  await waitFor(() => expect(view.getByTestId('settings-resume-enabled').props.disabled).toBe(false));
  expect(view.getByTestId('settings-resume-enabled').props.value).toBe(false);
  expect(storage.set).not.toHaveBeenCalled();
  fireEvent(view.getByTestId('settings-resume-enabled'), 'valueChange', true);
  await waitFor(() => expect(storage.set).toHaveBeenCalledWith('playbackResumeEnabled', true));
  view.unmount(); (storage.get as jest.Mock).mockResolvedValue(true);
  const restarted = render(<PlaybackResumeProvider><ResumeSettings /></PlaybackResumeProvider>);
  await waitFor(() => expect(restarted.getByTestId('settings-resume-enabled').props.value).toBe(true));
  fireEvent(restarted.getByTestId('settings-resume-enabled'), 'valueChange', false);
  await waitFor(() => expect(storage.set).toHaveBeenLastCalledWith('playbackResumeEnabled', false));
});
test('failed switch persistence rolls back instead of claiming it was saved', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  (storage.set as jest.Mock).mockResolvedValue(false);
  const view = render(<PlaybackResumeProvider><ResumeSettings /></PlaybackResumeProvider>);
  await waitFor(() => expect(view.getByTestId('settings-resume-enabled').props.disabled).toBe(false));
  fireEvent(view.getByTestId('settings-resume-enabled'), 'valueChange', true);
  await waitFor(() => expect(view.getByTestId('settings-resume-enabled').props.value).toBe(false));
  jest.restoreAllMocks();
});
test('positions are erased only after explicit confirmation with confirmed persistence', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const view = render(<PlaybackResumeProvider><ResumeSettings /></PlaybackResumeProvider>);
  await waitFor(() => expect(view.getByTestId('settings-resume-enabled').props.disabled).toBe(false));
  fireEvent.press(view.getByTestId('settings-resume-clear'));
  expect(storage.set).not.toHaveBeenCalled();
  const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
  await act(async () => buttons.find((button: any) => button.text === 'Löschen').onPress());
  // This mocked storage does not publish to native storage: read-back fails,
  // so the UI must report failure rather than a fictitious successful delete.
  expect(Alert.alert).toHaveBeenLastCalledWith('Positionen nicht gelöscht', expect.any(String));
  jest.restoreAllMocks();
});
