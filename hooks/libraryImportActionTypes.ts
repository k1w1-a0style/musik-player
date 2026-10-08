import type { SongImportController } from '../contexts/songLibraryState';
import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryTab } from '../utils/libraryTabs';
import type { LibraryAlertCopy } from './useLibraryAlerts';
import type { importSongsFromSources, scanMediaLibraryCandidates, enrichMediaLibraryAssets } from '../utils/mediaLibraryImport';
import type { confirmLibraryImport } from '../utils/libraryImportConfirmation';
import type { CancellableOperation, TimeoutOptions } from '../utils/withTimeout';
import type { getLibraryImportFlowCopy, ImportedSongsDelta } from '../utils/libraryImportFlow';
import type { CoverCacheProtection } from '../utils/coverCacheCleanup';

export type ImportedSongsStateUpdate = ImportedSongsDelta;

export interface ImportGeneration {
  controller: AbortController;
  id: number;
  coverCacheProtection?: CoverCacheProtection;
}

export type LibraryImportFlowCopy = ReturnType<typeof getLibraryImportFlowCopy>;

export type RequestMediaLibraryPermissions = () => Promise<{ status: string }>;
export type TimeoutRunner = <T>(operation: Promise<T> | CancellableOperation<T>, timeoutMs: number, timeoutMessage: string, options?: TimeoutOptions) => Promise<T>;

export interface UseLibraryImportActionsOptions {
  scanFolders: ScanFolder[];
  songs: Song[];
  songImport?: SongImportController;
  setSongs: (songs: Song[]) => void;
  setActiveTab: Dispatch<SetStateAction<LibraryTab>>;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setImportStatus: Dispatch<SetStateAction<string | null>>;
  showAlert: (alert: LibraryAlertCopy) => void;
  persistChangedFolderUpdates: (folderUpdates: ScanFolder[] | undefined) => Promise<void>;
  platformOs?: string;
  importTimeoutMs?: number;
  importSongsFromSourcesImpl?: typeof importSongsFromSources;
  requestMediaLibraryPermissionsAsync?: RequestMediaLibraryPermissions;
  scanMediaLibraryCandidatesImpl?: typeof scanMediaLibraryCandidates;
  enrichMediaLibraryAssetsImpl?: typeof enrichMediaLibraryAssets;
  confirmLibraryImportImpl?: typeof confirmLibraryImport;
  withTimeoutImpl?: TimeoutRunner;
}

export interface UseLibraryImportActionsResult {
  importFromDevice: (options?: { folders?: ScanFolder[]; refreshExisting?: boolean }) => Promise<void>;
  cancelImport: () => boolean;
}
