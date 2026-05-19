import {
  persistAddedScanFolder,
  persistChangedFolderErrorUpdates,
  persistRemovedScanFolder,
} from '../libraryScanFolderPersistence';
import { persistAddedScanFolder as directPersistAddedScanFolder } from '../libraryScanFolderAddPersistence';
import { persistChangedFolderErrorUpdates as directPersistChangedFolderErrorUpdates } from '../libraryFolderUpdatePersistence';
import { persistRemovedScanFolder as directPersistRemovedScanFolder } from '../libraryScanFolderRemovePersistence';
import type { ScanFolder } from '../../types/ScanFolder';

const folder = (id: string, patch: Partial<ScanFolder> = {}): ScanFolder => ({
  id,
  name: id,
  uri: `content://${id}`,
  addedAt: 1,
  enabled: true,
  ...patch,
});

test('exports scan folder persistence utilities', () => {
  expect(persistAddedScanFolder).toBe(directPersistAddedScanFolder);
  expect(persistChangedFolderErrorUpdates).toBe(directPersistChangedFolderErrorUpdates);
  expect(persistRemovedScanFolder).toBe(directPersistRemovedScanFolder);
});

test('persistAddedScanFolder returns added result when storage grows', async () => {
  const current = [folder('a')];
  const next = [folder('a'), folder('b')];
  const addScanFolderImpl = jest.fn().mockResolvedValue(next);

  await expect(persistAddedScanFolder(current, folder('b'), { addScanFolderImpl })).resolves.toEqual({
    kind: 'added',
    update: { scanFolders: next, activeTab: 'folders' },
  });
  expect(addScanFolderImpl).toHaveBeenCalledWith(folder('b'));
});

test('persistAddedScanFolder returns duplicate result when storage does not grow', async () => {
  const current = [folder('a')];
  const addScanFolderImpl = jest.fn().mockResolvedValue(current);

  await expect(persistAddedScanFolder(current, folder('a'), { addScanFolderImpl })).resolves.toEqual({
    kind: 'duplicate',
  });
});

test('persistRemovedScanFolder delegates to storage remove helper', async () => {
  const remaining = [folder('b')];
  const removeScanFolderImpl = jest.fn().mockResolvedValue(remaining);

  await expect(persistRemovedScanFolder('a', { removeScanFolderImpl })).resolves.toEqual(remaining);
  expect(removeScanFolderImpl).toHaveBeenCalledWith('a');
});

test('persistChangedFolderErrorUpdates returns null without updates', async () => {
  const updateScanFolderImpl = jest.fn();
  const getScanFoldersImpl = jest.fn();

  await expect(persistChangedFolderErrorUpdates([folder('a')], undefined, {
    updateScanFolderImpl,
    getScanFoldersImpl,
  })).resolves.toBeNull();
  expect(updateScanFolderImpl).not.toHaveBeenCalled();
  expect(getScanFoldersImpl).not.toHaveBeenCalled();
});

test('persistChangedFolderErrorUpdates stores changed lastError values and reloads folders', async () => {
  const current = [folder('a'), folder('b', { lastError: 'Alt' })];
  const updated = [folder('a', { lastError: 'Neu' }), folder('b')];
  const reloaded = [folder('a', { lastError: 'Neu' }), folder('b')];
  const updateScanFolderImpl = jest.fn().mockResolvedValue([]);
  const getScanFoldersImpl = jest.fn().mockResolvedValue(reloaded);

  await expect(persistChangedFolderErrorUpdates(current, updated, {
    updateScanFolderImpl,
    getScanFoldersImpl,
  })).resolves.toEqual(reloaded);
  expect(updateScanFolderImpl).toHaveBeenNthCalledWith(1, 'a', { lastError: 'Neu' });
  expect(updateScanFolderImpl).toHaveBeenNthCalledWith(2, 'b', { lastError: undefined });
  expect(getScanFoldersImpl).toHaveBeenCalledTimes(1);
});
