import React from 'react';
import { Button } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useLibraryScanFolderActions, type UseLibraryScanFolderActionsOptions } from '../useLibraryScanFolderActions';
import type { ScanFolder } from '../../types/ScanFolder';
import {
  persistAddedScanFolder,
  persistChangedFolderErrorUpdates,
  persistRemovedScanFolder,
} from '../../utils/libraryScanFolderPersistence';
import {
  getDuplicateScanFolderAlert,
  getScanFolderCancelledAlert,
  getScanFolderRemoveFailedAlert,
  getScanFolderUnavailableAlert,
  getScanFolderUnsupportedAlert,
} from '../../utils/libraryFolderMessages';

jest.mock('../../utils/libraryScanFolderPersistence', () => ({
  persistAddedScanFolder: jest.fn(),
  persistChangedFolderErrorUpdates: jest.fn(),
  persistRemovedScanFolder: jest.fn(),
}));

const mockedPersistAddedScanFolder = jest.mocked(persistAddedScanFolder);
const mockedPersistChangedFolderErrorUpdates = jest.mocked(persistChangedFolderErrorUpdates);
const mockedPersistRemovedScanFolder = jest.mocked(persistRemovedScanFolder);

const folder = (id: string): ScanFolder => ({
  id,
  name: id,
  uri: `content://${id}`,
  addedAt: 1,
  enabled: true,
});

type HookHarnessProps = Partial<UseLibraryScanFolderActionsOptions>;

const HookHarness = ({
  scanFolders = [folder('a')],
  platformOs = 'android',
  requestDirectoryPermissionsAsync = jest.fn().mockResolvedValue({ granted: true, directoryUri: 'content://music' }),
  setScanFolders = jest.fn(),
  setActiveTab = jest.fn(),
  setMenuOpen = jest.fn(),
  showAlert = jest.fn(),
}: HookHarnessProps) => {
  const options: UseLibraryScanFolderActionsOptions = {
    scanFolders,
    setScanFolders,
    setActiveTab,
    setMenuOpen,
    showAlert,
    platformOs,
    requestDirectoryPermissionsAsync,
  };

  const actions = useLibraryScanFolderActions(options);

  return (
    <>
      <Button title="show" onPress={actions.showScanFolders} />
      <Button title="add" onPress={() => void actions.onAddScanFolder()} />
      <Button title="persist" onPress={() => void actions.persistChangedFolderUpdates([folder('changed')])} />
      <Button title="persist-empty" onPress={() => void actions.persistChangedFolderUpdates(undefined)} />
      <Button title="remove" onPress={() => void actions.removeFolder(scanFolders[0])} />
    </>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('showScanFolders selects folders tab and closes menu', () => {
  const setScanFolders = jest.fn();
  const setActiveTab = jest.fn();
  const setMenuOpen = jest.fn();
  const screen = render(<HookHarness setScanFolders={setScanFolders} setActiveTab={setActiveTab} setMenuOpen={setMenuOpen} />);

  fireEvent.press(screen.getByText('show'));

  expect(setScanFolders).toHaveBeenCalledWith([folder('a')]);
  expect(setActiveTab).toHaveBeenCalledWith('folders');
  expect(setMenuOpen).toHaveBeenCalledWith(false);
});

test('onAddScanFolder shows unsupported alert on non-android platforms', async () => {
  const showAlert = jest.fn();
  const setMenuOpen = jest.fn();
  const requestDirectoryPermissionsAsync = jest.fn();
  const screen = render(
    <HookHarness
      platformOs="ios"
      showAlert={showAlert}
      setMenuOpen={setMenuOpen}
      requestDirectoryPermissionsAsync={requestDirectoryPermissionsAsync}
    />,
  );

  fireEvent.press(screen.getByText('add'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getScanFolderUnsupportedAlert()));
  expect(setMenuOpen).toHaveBeenCalledWith(false);
  expect(requestDirectoryPermissionsAsync).not.toHaveBeenCalled();
});

test('onAddScanFolder shows cancelled alert when picker has no granted uri', async () => {
  const showAlert = jest.fn();
  const requestDirectoryPermissionsAsync = jest.fn().mockResolvedValue({ granted: false });
  const screen = render(<HookHarness showAlert={showAlert} requestDirectoryPermissionsAsync={requestDirectoryPermissionsAsync} />);

  fireEvent.press(screen.getByText('add'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getScanFolderCancelledAlert()));
  expect(mockedPersistAddedScanFolder).not.toHaveBeenCalled();
});

test('onAddScanFolder persists added folder and activates folders tab', async () => {
  const setScanFolders = jest.fn();
  const setActiveTab = jest.fn();
  const setMenuOpen = jest.fn();
  mockedPersistAddedScanFolder.mockResolvedValue({
    kind: 'added',
    update: { scanFolders: [folder('a'), folder('b')], activeTab: 'folders' },
  });
  const screen = render(<HookHarness setScanFolders={setScanFolders} setActiveTab={setActiveTab} setMenuOpen={setMenuOpen} />);

  fireEvent.press(screen.getByText('add'));

  await waitFor(() => expect(mockedPersistAddedScanFolder).toHaveBeenCalled());
  expect(mockedPersistAddedScanFolder).toHaveBeenCalledWith([folder('a')], expect.objectContaining({
    enabled: true,
    name: 'music',
    uri: 'content://music',
  }));
  expect(setMenuOpen).toHaveBeenCalledWith(false);
  expect(setScanFolders).toHaveBeenCalledWith([folder('a'), folder('b')]);
  expect(setActiveTab).toHaveBeenCalledWith('folders');
});

test('onAddScanFolder shows duplicate alert when persistence reports duplicate', async () => {
  const showAlert = jest.fn();
  const setScanFolders = jest.fn();
  const setActiveTab = jest.fn();
  mockedPersistAddedScanFolder.mockResolvedValue({ kind: 'duplicate' });
  const screen = render(<HookHarness showAlert={showAlert} setScanFolders={setScanFolders} setActiveTab={setActiveTab} />);

  fireEvent.press(screen.getByText('add'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getDuplicateScanFolderAlert()));
  expect(setScanFolders).not.toHaveBeenCalled();
  expect(setActiveTab).not.toHaveBeenCalled();
});

test('onAddScanFolder shows unavailable alert when picker fails', async () => {
  const showAlert = jest.fn();
  const requestDirectoryPermissionsAsync = jest.fn().mockRejectedValue(new Error('boom'));
  const screen = render(<HookHarness showAlert={showAlert} requestDirectoryPermissionsAsync={requestDirectoryPermissionsAsync} />);

  fireEvent.press(screen.getByText('add'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getScanFolderUnavailableAlert()));
});

test('onAddScanFolder shows unavailable alert when persistence fails', async () => {
  const showAlert = jest.fn();
  mockedPersistAddedScanFolder.mockRejectedValue(new Error('persist failed'));
  const screen = render(<HookHarness showAlert={showAlert} />);

  fireEvent.press(screen.getByText('add'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getScanFolderUnavailableAlert()));
});

test('persistChangedFolderUpdates updates folders only when persistence returns updates', async () => {
  const setScanFolders = jest.fn();
  mockedPersistChangedFolderErrorUpdates.mockResolvedValue([folder('changed')]);
  const screen = render(<HookHarness setScanFolders={setScanFolders} />);

  fireEvent.press(screen.getByText('persist'));

  await waitFor(() => expect(mockedPersistChangedFolderErrorUpdates).toHaveBeenCalledWith([folder('a')], [folder('changed')]));
  expect(setScanFolders).toHaveBeenCalledWith([folder('changed')]);

  mockedPersistChangedFolderErrorUpdates.mockResolvedValueOnce(null);
  setScanFolders.mockClear();
  fireEvent.press(screen.getByText('persist-empty'));

  await waitFor(() => expect(mockedPersistChangedFolderErrorUpdates).toHaveBeenCalledWith([folder('a')], undefined));
  expect(setScanFolders).not.toHaveBeenCalled();
});

test('removeFolder persists removal and updates folders', async () => {
  const setScanFolders = jest.fn();
  mockedPersistRemovedScanFolder.mockResolvedValue([folder('b')]);
  const screen = render(<HookHarness setScanFolders={setScanFolders} />);

  fireEvent.press(screen.getByText('remove'));

  await waitFor(() => expect(mockedPersistRemovedScanFolder).toHaveBeenCalledWith('a'));
  expect(setScanFolders).toHaveBeenCalledWith([folder('b')]);
});

test('removeFolder reports a persistence failure without updating folders', async () => {
  const setScanFolders = jest.fn();
  const showAlert = jest.fn();
  mockedPersistRemovedScanFolder.mockRejectedValue(new Error('remove failed'));
  const screen = render(<HookHarness setScanFolders={setScanFolders} showAlert={showAlert} />);

  fireEvent.press(screen.getByText('remove'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getScanFolderRemoveFailedAlert()));
  expect(setScanFolders).not.toHaveBeenCalled();
});
