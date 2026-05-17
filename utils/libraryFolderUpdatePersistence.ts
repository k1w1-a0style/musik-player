import type { ScanFolder } from '../types/ScanFolder';
import { buildFolderUpdatesResult } from './libraryFolderUpdates';
import { getScanFolders, updateScanFolder } from './storage';

interface FolderUpdatePersistenceDependencies {
  updateScanFolderImpl?: typeof updateScanFolder;
  getScanFoldersImpl?: typeof getScanFolders;
}

export const persistChangedFolderErrorUpdates = async (
  currentFolders: ScanFolder[],
  folderUpdates: ScanFolder[] | undefined,
  dependencies: FolderUpdatePersistenceDependencies = {},
): Promise<ScanFolder[] | null> => {
  const updatesResult = buildFolderUpdatesResult(currentFolders, folderUpdates);
  if (updatesResult.kind === 'none') return null;

  const updateScanFolderImpl = dependencies.updateScanFolderImpl ?? updateScanFolder;
  const getScanFoldersImpl = dependencies.getScanFoldersImpl ?? getScanFolders;

  for (const folder of updatesResult.updates) {
    await updateScanFolderImpl(folder.id, { lastError: folder.lastError });
  }

  return getScanFoldersImpl();
};
