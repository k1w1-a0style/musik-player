import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackupSettings from '../BackupSettings';
import { BackupMaintenanceBoundary } from '../BackupMaintenanceBoundary';
import { AppThemeProvider } from '../../contexts/AppThemeContext';
import * as files from '../../utils/backupFiles';
import type { MusicBackup } from '../../utils/backupFormat';
import { storage } from '../../utils/storage';
import { resetSafWriteStartupForTests } from '../../utils/tagWriterLocks';
const mockBackup: MusicBackup = { format: 'k1w1-musik-backup', version: 1, createdAt: 1,
  songs: [], playlists: [{ id: 'p', name: 'Meine Sicherung', songIds: [], createdAt: 1, updatedAt: 1 }], favorites: [], settings: {} };
jest.mock('../../utils/backupFiles', () => ({ writeBackupFile: jest.fn(), chooseBackupFolder: jest.fn(),
  readBackupFile: jest.fn(), backupFileLabel: () => 'Sicherung.json' }));
beforeEach(async () => {
  jest.clearAllMocks(); await AsyncStorage.clear(); resetSafWriteStartupForTests();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());
const renderSettings = () => render(<BackupMaintenanceBoundary><AppThemeProvider><BackupSettings /></AppThemeProvider></BackupMaintenanceBoundary>);
test('export stays in Settings and reports success only when the file adapter confirms the write', async () => {
  jest.mocked(files.writeBackupFile).mockResolvedValue('content://confirmed');
  const screen = renderSettings();
  await waitFor(() => expect(screen.getByTestId('backup-create')).toBeTruthy());
  fireEvent.press(screen.getByTestId('backup-create'));
  await waitFor(() => expect(files.writeBackupFile).toHaveBeenCalledWith(expect.objectContaining({ format: 'k1w1-musik-backup', version: 1 })));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Backup gespeichert', expect.any(String)));
});
test('selecting and inspecting does not alter collection; only applying the visible preview restores it', async () => {
  jest.mocked(files.chooseBackupFolder).mockResolvedValue(['content://backup-file']);
  jest.mocked(files.readBackupFile).mockResolvedValue({ backup: mockBackup, raw: JSON.stringify(mockBackup) });
  const screen = renderSettings();
  await waitFor(() => expect(screen.getByTestId('backup-inspect')).toBeTruthy());
  fireEvent.press(screen.getByTestId('backup-inspect'));
  await waitFor(() => expect(screen.getByText('Sicherung.json')).toBeTruthy());
  fireEvent.press(screen.getByText('Sicherung.json'));
  await waitFor(() => expect(screen.getByTestId('backup-preview')).toBeTruthy());
  expect(await storage.getPlaylists()).toEqual([]);
  expect(screen.queryByTestId('backup-restore-apply')).toBeNull();
  fireEvent.press(screen.getByText('Schließen'));
  fireEvent.press(screen.getByTestId('backup-select-restore'));
  await waitFor(() => expect(screen.getByText('Sicherung.json')).toBeTruthy());
  fireEvent.press(screen.getByText('Sicherung.json'));
  await waitFor(() => expect(screen.getByTestId('backup-restore-apply')).toBeTruthy());
  fireEvent.press(screen.getByTestId('backup-restore-apply'));
  await waitFor(async () => expect((await storage.getPlaylists())[0]?.name).toBe('Meine Sicherung'));
  await waitFor(() => expect(screen.getByTestId('settings-backup')).toBeTruthy());
});
test('export failure and cancelled selection never claim backup success or mutate the collection', async () => {
  jest.mocked(files.writeBackupFile).mockRejectedValue(new Error('disk full'));
  jest.mocked(files.chooseBackupFolder).mockResolvedValue(null);
  const screen = renderSettings();
  await waitFor(() => expect(screen.getByTestId('backup-create')).toBeTruthy());
  fireEvent.press(screen.getByTestId('backup-create'));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Backup nicht abgeschlossen', 'disk full'));
  fireEvent.press(screen.getByTestId('backup-inspect'));
  await waitFor(() => expect(files.chooseBackupFolder).toHaveBeenCalled());
  expect(screen.queryByTestId('backup-preview')).toBeNull();
  expect(await storage.getPlaylists()).toEqual([]);
});
