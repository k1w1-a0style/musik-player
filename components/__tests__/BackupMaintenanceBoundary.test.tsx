import React from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackupMaintenanceBoundary, useBackupMaintenance } from '../BackupMaintenanceBoundary';
import { useHydratedStoredPreference } from '../../hooks/useHydratedStoredPreference';
import { storage } from '../../utils/storage';
import { backupLibrarySignature } from '../../utils/backupService';
import type { MusicBackup } from '../../utils/backupFormat';
import { releasePersistenceMaintenance } from '../../utils/persistenceMaintenance';

const prefix = '@musikplayer:';
const journalKey = prefix + 'backupRestoreJournalV1';
const setMock = AsyncStorage.setItem as jest.Mock;
const setImpl = setMock.getMockImplementation()!;
const load = async () => (await storage.get('appThemeSkin')) as string ?? 'graphite';
const persist = async (value: string) => { await storage.set('appThemeSkin', value); };
const normalize = (value: string) => value;
const backup: MusicBackup = { format: 'k1w1-musik-backup', version: 1, createdAt: 1,
  songs: [], playlists: [], favorites: [], settings: { appThemeSkin: 'minimal' } };
let lateSetter: ((value: string) => void) | undefined;
const Harness = () => {
  const maintenance = useBackupMaintenance();
  const preference = useHydratedStoredPreference({ defaultValue: 'graphite', load, persist, normalize, label: 'test-skin' });
  lateSetter = preference.setValue;
  return <><Text testID="collection">{preference.value}</Text>
    <Pressable testID="change-setting" onPress={() => preference.setValue('neon-cover')} />
    <Pressable testID="restore-backup" onPress={() => maintenance?.restore({ backup, manual: {}, applySettings: true,
      previewSources: backupLibrarySignature([]) })} /></>;
};
beforeEach(async () => {
  setMock.mockImplementation(setImpl); releasePersistenceMaintenance();
  await AsyncStorage.clear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => { setMock.mockImplementation(setImpl); jest.restoreAllMocks(); releasePersistenceMaintenance(); });

test('providers never hydrate a partially restored collection; retry remains available for corrupt journal', async () => {
  await AsyncStorage.setItem(journalKey, '{');
  const screen = render(<BackupMaintenanceBoundary><Harness /></BackupMaintenanceBoundary>);
  await waitFor(() => expect(screen.getByTestId('backup-recovery-retry')).toBeTruthy());
  expect(screen.queryByTestId('collection')).toBeNull();
  await AsyncStorage.removeItem(journalKey);
  fireEvent.press(screen.getByTestId('backup-recovery-retry'));
  await waitFor(() => expect(screen.getByTestId('collection')).toBeTruthy());
});
test('restore waits for the real old write; an old unmounted setter cannot overwrite restored preferences', async () => {
  let finish!: () => void;
  const delayed = new Promise<void>(resolve => { finish = resolve; });
  let block = true;
  setMock.mockImplementation(async (key, value) => {
    if (key === prefix + 'appThemeSkin' && value === '"neon-cover"' && block) { block = false; await delayed; }
    await setImpl(key, value);
  });
  const screen = render(<BackupMaintenanceBoundary><Harness /></BackupMaintenanceBoundary>);
  await waitFor(() => expect(screen.getByTestId('collection').props.children).toBe('graphite'));
  fireEvent.press(screen.getByTestId('change-setting'));
  await waitFor(() => expect(block).toBe(false));
  const oldSetter = lateSetter!;
  fireEvent.press(screen.getByTestId('restore-backup'));
  expect(screen.queryByTestId('collection')).toBeNull();
  expect(await AsyncStorage.getItem(journalKey)).toBeNull();
  await act(async () => { finish(); await delayed; });
  await waitFor(() => expect(screen.getByTestId('collection').props.children).toBe('minimal'));
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  await act(async () => oldSetter('neon-cover'));
  expect(await storage.get('appThemeSkin')).toBe('minimal');
  expect(warning).toHaveBeenCalledWith(expect.stringContaining('Failed to persist'), expect.any(Error));
  expect(await AsyncStorage.getItem(journalKey)).toBeNull();
});
test('startup rolls back an interrupted restore before publishing providers', async () => {
  await AsyncStorage.setItem(prefix + 'appThemeSkin', '"neon-cover"');
  await AsyncStorage.setItem(journalKey, JSON.stringify({ version: 1, phase: 'prepared',
    before: [{ key: 'appThemeSkin', raw: '"graphite"' }], after: [{ key: 'appThemeSkin', raw: '"neon-cover"' }] }));
  const screen = render(<BackupMaintenanceBoundary><Harness /></BackupMaintenanceBoundary>);
  expect(screen.queryByTestId('collection')).toBeNull();
  await waitFor(() => expect(screen.getByTestId('collection').props.children).toBe('graphite'));
  expect(await AsyncStorage.getItem(journalKey)).toBeNull();
});
