import React from 'react';
import { Button } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { useLibraryScanFolderActions } from '../useLibraryScanFolderActions';
import type { ScanFolder } from '../../types/ScanFolder';
import type { LibraryTab } from '../../utils/libraryTabs';
import { persistAddedScanFolder, persistRemovedScanFolder } from '../../utils/libraryScanFolderPersistence';
import { getScanFolderCancelledAlert, getScanFolderUnsupportedAlert } from '../../utils/libraryFolderMessages';

jest.mock('../../utils/libraryScanFolderPersistence', () => ({
  persistAddedScanFolder: jest.fn(),
  persistChangedFolderErrorUpdates: jest.fn(),
  persistRemovedScanFolder: jest.fn(),
}));

const mockedPersistAddedScanFolder = jest.mocked(persistAddedScanFolder);
const mockedPersistRemovedScanFolder = jest.mocked(persistRemovedScanFolder);

const folder = (id: string): ScanFolder => ({
  id,
  name: id,
  uri: `content://${id}`,
  addedAt: 1,
  enabled: true,
});

interface HookHarnessProps {
  scanFolders?: ScanFolder[];
  platformOs?: string;
  requestDirectoryPermissionsAsync?: () => Promise<{ granted?: boolean; directoryUri?: string | null }>;
  setScanFolders?: React.Dispatch<React.SetStateAction<ScanFolder[]>>;
  setActiveTab?: React.Dispatch<React.SetStateAction<LibraryTab>>;
  setMenuOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  showAlert?: jest.Mock;
}

const HookHarness = ({
  scanFolders = [folder('a')],
  platformOs = 'android',
  requestDirectoryPermissionsAsync = jest.fn().mockResolvedValue({ granted: true, directoryUri: 'content://music' }),
  setScanFolders = jest.fn(),
  setActiveTab = jest.fn(),
  setMenuOpen = jest.fn(),
  showAlert = jest.fn(),
}: HookHarnessProps) => {
  const actions = useLibraryScanFolderActions({
    scanFolders,
    setScanFolders,
    setActiveTab,
    setMenuOpen,
    showAlert,
    platformOs,
    requestDirectoryPermissionsAsync,
  });

  return (
    <>
      <Button title="show" onPress={actions.showScanFolders} />
      <Button title="add" onPress={() => void actions.onAddScanFolder()} />
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

  act(() => {
    screen.getByText('show').props.onPress();
  });

  expect(setScanFolders).toHaveBeenCalledWith([folder('a')]);
  expect(setActiveTab).toHaveBeenCalledWith('folders');
  expect(setMenuOpen).toHaveBeenCalledWith(false);
});

test('onAddScanFolder shows unsupported alert on non-android platforms', async () => {
  const showAlert = jest.fn();
  const requestDirectoryPermissionsAsync = jest.fn();
  const screen = render(<HookHarness platformOs="ios" showAlert={showAlert} requestDirectoryPermissionsAsync={requestDirectoryPermissionsAsync} />);

  await act(async () => {
    await screen.getByText('add').props.onPress();
  });

  expect(showAlert).toHaveBeenCalledWith(getScanFolderUnsupportedAlert());
  expect(requestDirectoryPermissionsAsync).not.toHaveBeenCalled();
});

test('onAddScanFolder shows cancelled alert when picker has no granted uri', async () => {
  const showAlert = jest.fn();
  const requestDirectoryPermissionsAsync = jest.fn().mockResolvedValue({ granted: false });
  const screen = render(<HookHarness showAlert={showAlert} requestDirectoryPermissionsAsync={requestDirectoryPermissionsAsync} />);

  await act(async () => {
    await screen.getByText('add').props.onPress();
  });

  expect(showAlert).toHaveBeenCalledWith(getScanFolderCancelledAlert());
  expect(mockedPersistAddedScanFolder).not.toHaveBeenCalled();
});

test('removeFolder persists removal and updates folders', async () => {
  const setScanFolders = jest.fn();
  mockedPersistRemovedScanFolder.mockResolvedValue([folder('b')]);
  const screen = render(<HookHarness setScanFolders={setScanFolders} />);

  await act(async () => {
    await screen.getByText('remove').props.onPress();
  });

  expect(mockedPersistRemovedScanFolder).toHaveBeenCalledWith('a');
  expect(setScanFolders).toHaveBeenCalledWith([folder('b')]);
});
