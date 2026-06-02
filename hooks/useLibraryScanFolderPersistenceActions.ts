import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ScanFolder } from '../types/ScanFolder';
import {
  persistChangedFolderErrorUpdates,
  persistRemovedScanFolder,
} from '../utils/libraryScanFolderPersistence';

interface UseLibraryScanFolderPersistenceActionsOptions {
  scanFolders: ScanFolder[];
  setScanFolders: Dispatch<SetStateAction<ScanFolder[]>>;
}

interface LibraryScanFolderPersistenceActions {
  persistChangedFolderUpdates: (folderUpdates: ScanFolder[] | undefined) => Promise<void>;
  removeFolder: (folder: ScanFolder) => Promise<void>;
}

export const useLibraryScanFolderPersistenceActions = ({
  scanFolders,
  setScanFolders,
}: UseLibraryScanFolderPersistenceActionsOptions): LibraryScanFolderPersistenceActions => {
  const persistChangedFolderUpdates = useCallback(async (folderUpdates: ScanFolder[] | undefined): Promise<void> => {
    const updatedFolders = await persistChangedFolderErrorUpdates(scanFolders, folderUpdates);
    if (updatedFolders) setScanFolders(updatedFolders);
  }, [scanFolders, setScanFolders]);

  const removeFolder = useCallback(async (folder: ScanFolder): Promise<void> => {
    setScanFolders(await persistRemovedScanFolder(folder.id));
  }, [setScanFolders]);

  return { persistChangedFolderUpdates, removeFolder };
};
