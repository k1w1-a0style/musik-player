import { useCallback } from 'react';
import type {
  ApplyScanFolderStateUpdateOptions,
  LibraryScanFolderStateUpdateActions,
  ScanFolderStateUpdate,
} from './libraryScanFolderActionTypes';

export const applyScanFolderStateUpdate = (
  update: ScanFolderStateUpdate,
  { setScanFolders, setActiveTab }: ApplyScanFolderStateUpdateOptions,
): void => {
  setScanFolders(update.scanFolders);
  setActiveTab(update.activeTab);
};

export const useLibraryScanFolderStateUpdate = (
  options: ApplyScanFolderStateUpdateOptions,
): LibraryScanFolderStateUpdateActions => {
  const { setScanFolders, setActiveTab } = options;

  const applyUpdate = useCallback((update: ScanFolderStateUpdate): void => {
    applyScanFolderStateUpdate(update, { setScanFolders, setActiveTab });
  }, [setActiveTab, setScanFolders]);

  return { applyScanFolderStateUpdate: applyUpdate };
};
