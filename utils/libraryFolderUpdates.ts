import type { ScanFolder } from '../types/ScanFolder';

export const shouldPersistFolderErrorUpdate = (
  original: ScanFolder | undefined,
  updated: Pick<ScanFolder, 'lastError'>,
): boolean => !original || original.lastError !== updated.lastError;

export const getChangedFolderUpdates = (
  currentFolders: ScanFolder[],
  updatedFolders: ScanFolder[] | undefined,
): ScanFolder[] => {
  if (!updatedFolders) return [];
  return updatedFolders.filter(folder => {
    const original = currentFolders.find(item => item.id === folder.id);
    return shouldPersistFolderErrorUpdate(original, folder);
  });
};
