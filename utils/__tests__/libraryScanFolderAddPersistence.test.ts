import { persistAddedScanFolder } from '../libraryScanFolderAddPersistence';
import { buildScanFolderAddResult } from '../libraryScanFolders';
import type { ScanFolder } from '../../types/ScanFolder';

const folder = (id: string): ScanFolder => ({
  id,
  name: id,
  uri: `content://${id}`,
  addedAt: 1,
  enabled: true,
});

test('persists scan folder and returns added result', async () => {
  const currentFolders = [folder('a')];
  const nextFolders = [folder('a'), folder('b')];
  const addScanFolderImpl = jest.fn().mockResolvedValue(nextFolders);

  await expect(persistAddedScanFolder(currentFolders, folder('b'), { addScanFolderImpl })).resolves.toEqual(
    buildScanFolderAddResult(currentFolders, nextFolders),
  );

  expect(addScanFolderImpl).toHaveBeenCalledTimes(1);
  expect(addScanFolderImpl).toHaveBeenCalledWith(folder('b'));
});

test('persists scan folder and returns duplicate result', async () => {
  const currentFolders = [folder('a')];
  const nextFolders = [folder('a')];
  const addScanFolderImpl = jest.fn().mockResolvedValue(nextFolders);

  await expect(persistAddedScanFolder(currentFolders, folder('a'), { addScanFolderImpl })).resolves.toEqual({ kind: 'duplicate' });

  expect(addScanFolderImpl).toHaveBeenCalledTimes(1);
  expect(addScanFolderImpl).toHaveBeenCalledWith(folder('a'));
});
