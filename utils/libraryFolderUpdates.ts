import type { ScanFolder } from '../types/ScanFolder';

interface NoChangedFolderUpdatesResult {
  kind: 'none';
}

interface ChangedFolderUpdatesResult {
  kind: 'changed';
  updates: ScanFolder[];
}

type FolderUpdatesResult = NoChangedFolderUpdatesResult | ChangedFolderUpdatesResult;

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

export const buildFolderUpdatesResult = (
  currentFolders: ScanFolder[],
  updatedFolders: ScanFolder[] | undefined,
): FolderUpdatesResult => {
  const updates = getChangedFolderUpdates(currentFolders, updatedFolders);

  if (updates.length === 0) return { kind: 'none' };

  return { kind: 'changed', updates };
};
