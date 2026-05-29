import type { ScanFolder } from '../types/ScanFolder';
import { removeScanFolder } from './storage';

interface ScanFolderRemovePersistenceDependencies {
  removeScanFolderImpl?: typeof removeScanFolder;
}

export const persistRemovedScanFolder = async (
  folderId: string,
  dependencies: ScanFolderRemovePersistenceDependencies = {},
): Promise<ScanFolder[]> => {
  const removeScanFolderImpl = dependencies.removeScanFolderImpl ?? removeScanFolder;

  return removeScanFolderImpl(folderId);
};
