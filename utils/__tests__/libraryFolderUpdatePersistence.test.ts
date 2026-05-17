import { persistChangedFolderErrorUpdates } from '../libraryFolderUpdatePersistence';
import type { ScanFolder } from '../../types/ScanFolder';

const folder = (patch: Partial<ScanFolder>): ScanFolder => ({
  id: 'folder-1',
  name: 'Music',
  uri: 'content://music',
  addedAt: 1,
  enabled: true,
  ...patch,
});

test('returns null when there are no folder updates', async () => {
  const updateScanFolderImpl = jest.fn();
  const getScanFoldersImpl = jest.fn();

  await expect(persistChangedFolderErrorUpdates([folder({})], undefined, { updateScanFolderImpl, getScanFoldersImpl })).resolves.toBeNull();

  expect(updateScanFolderImpl).not.toHaveBeenCalled();
  expect(getScanFoldersImpl).not.toHaveBeenCalled();
});

test('returns null when folder updates did not change error state', async () => {
  const updateScanFolderImpl = jest.fn();
  const getScanFoldersImpl = jest.fn();

  await expect(
    persistChangedFolderErrorUpdates(
      [folder({ id: 'a', lastError: 'same' })],
      [folder({ id: 'a', lastError: 'same' })],
      { updateScanFolderImpl, getScanFoldersImpl },
    ),
  ).resolves.toBeNull();

  expect(updateScanFolderImpl).not.toHaveBeenCalled();
  expect(getScanFoldersImpl).not.toHaveBeenCalled();
});

test('persists changed folder error updates and returns refreshed folders', async () => {
  const refreshedFolders = [folder({ id: 'a', lastError: undefined }), folder({ id: 'b', lastError: 'new' })];
  const updateScanFolderImpl = jest.fn().mockResolvedValue(undefined);
  const getScanFoldersImpl = jest.fn().mockResolvedValue(refreshedFolders);

  await expect(
    persistChangedFolderErrorUpdates(
      [folder({ id: 'a', lastError: 'same' }), folder({ id: 'b', lastError: 'old' })],
      [folder({ id: 'a', lastError: 'same' }), folder({ id: 'b', lastError: 'new' })],
      { updateScanFolderImpl, getScanFoldersImpl },
    ),
  ).resolves.toBe(refreshedFolders);

  expect(updateScanFolderImpl).toHaveBeenCalledTimes(1);
  expect(updateScanFolderImpl).toHaveBeenCalledWith('b', { lastError: 'new' });
  expect(getScanFoldersImpl).toHaveBeenCalledTimes(1);
});
