import { persistRemovedScanFolder } from '../libraryScanFolderRemovePersistence';
import type { ScanFolder } from '../../types/ScanFolder';

const folder = (id: string): ScanFolder => ({
  id,
  name: id,
  uri: `content://${id}`,
  addedAt: 1,
  enabled: true,
});

test('removes scan folder and returns updated folders', async () => {
  const updatedFolders = [folder('b')];
  const removeScanFolderImpl = jest.fn().mockResolvedValue(updatedFolders);

  await expect(persistRemovedScanFolder('a', { removeScanFolderImpl })).resolves.toBe(updatedFolders);

  expect(removeScanFolderImpl).toHaveBeenCalledTimes(1);
  expect(removeScanFolderImpl).toHaveBeenCalledWith('a');
});
