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
): boolean => !!original && original.lastError !== updated.lastError;

export const dedupeFolderUpdatesById = (updatedFolders: ScanFolder[] | undefined): ScanFolder[] => {
  if (!updatedFolders) return [];
  const byId = new Map<string, ScanFolder>();
  updatedFolders.forEach(folder => {
    if (!folder.id.trim()) return;
    byId.set(folder.id, folder);
  });
  return [...byId.values()];
};

export const getChangedFolderUpdates = (
  currentFolders: ScanFolder[],
  updatedFolders: ScanFolder[] | undefined,
): ScanFolder[] => {
  const currentById = new Map(currentFolders.map(folder => [folder.id, folder]));
  return dedupeFolderUpdatesById(updatedFolders).filter(folder => {
    const original = currentById.get(folder.id);
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