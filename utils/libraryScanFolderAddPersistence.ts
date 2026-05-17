import type { ScanFolder } from '../types/ScanFolder';
import { buildScanFolderAddResult } from './libraryScanFolders';
import { addScanFolder } from './storage';

interface ScanFolderAddPersistenceDependencies {
  addScanFolderImpl?: typeof addScanFolder;
}

export const persistAddedScanFolder = async (
  currentFolders: ScanFolder[],
  folder: ScanFolder,
  dependencies: ScanFolderAddPersistenceDependencies = {},
): Promise<ReturnType<typeof buildScanFolderAddResult>> => {
  const addScanFolderImpl = dependencies.addScanFolderImpl ?? addScanFolder;
  const nextFolders = await addScanFolderImpl(folder);

  return buildScanFolderAddResult(currentFolders, nextFolders);
};
