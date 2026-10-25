import type { LibraryScanRequest } from '../utils/libraryScanSources';
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
import type { AudioPermissionQuery } from '../utils/mediaLibraryReadAccess';

export type ImportedSongsStateUpdate = ImportedSongsDelta;

export interface ImportGeneration {
  automatic?: boolean;
  scanOperationId?: number;
  controller: AbortController;
  id: number;
  coverCacheProtection?: CoverCacheProtection;
}

export type LibraryImportFlowCopy = ReturnType<typeof getLibraryImportFlowCopy>;

export type RequestMediaLibraryPermissions = AudioPermissionQuery;
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
  getMediaLibraryPermissionsAsync?: RequestMediaLibraryPermissions;
  onSelectMusicFolder?: () => void;
  scanMediaLibraryCandidatesImpl?: typeof scanMediaLibraryCandidates;
  enrichMediaLibraryAssetsImpl?: typeof enrichMediaLibraryAssets;
  confirmLibraryImportImpl?: typeof confirmLibraryImport;
  withTimeoutImpl?: TimeoutRunner;
}

export interface UseLibraryImportActionsResult {
  importFromDevice: (options?: LibraryScanRequest & { folders?: ScanFolder[] }) => Promise<void>;
  cancelImport: () => boolean;
}
