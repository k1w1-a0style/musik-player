import type { Dispatch, SetStateAction } from 'react';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryTab } from '../utils/libraryTabs';
import type { LibraryAlertCopy } from './useLibraryAlerts';
import type { buildScanFolderStateUpdate } from '../utils/libraryScanFolders';

export interface DirectoryPermissionResultLike {
  granted?: boolean;
  directoryUri?: string | null;
}

export type RequestDirectoryPermissions = () => Promise<DirectoryPermissionResultLike>;

export type ScanFolderStateUpdate = ReturnType<typeof buildScanFolderStateUpdate>;

export interface ApplyScanFolderStateUpdateOptions {
  setScanFolders: Dispatch<SetStateAction<ScanFolder[]>>;
  setActiveTab: Dispatch<SetStateAction<LibraryTab>>;
}

export interface LibraryScanFolderStateUpdateActions {
  applyScanFolderStateUpdate: (update: ScanFolderStateUpdate) => void;
}

export interface LibraryScanFolderAlertActions {
  showAlert: (alert: LibraryAlertCopy) => void;
}
