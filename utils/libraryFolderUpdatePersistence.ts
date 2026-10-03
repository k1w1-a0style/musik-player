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
  const getScanFoldersImpl = dependencies.getScanFoldersImpl ?? getScanFolders;
  // A just-added folder can finish importing before its React state reaches the
  // import callback. Compare that folder against the already-persisted list.
  const latestFolders = folderUpdates?.some(folder => !currentFolders.some(current => current.id === folder.id))
    ? await getScanFoldersImpl() : currentFolders;
  const updatesResult = buildFolderUpdatesResult(latestFolders, folderUpdates);
  if (updatesResult.kind === 'none') return null;

  const updateScanFolderImpl = dependencies.updateScanFolderImpl ?? updateScanFolder;

  for (const folder of updatesResult.updates) {
    await updateScanFolderImpl(folder.id, { lastError: folder.lastError });
  }

  return getScanFoldersImpl();
};
