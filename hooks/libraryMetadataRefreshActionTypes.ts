import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import type { refreshSongsFromId3 } from '../utils/songMetadataRefresh';
import type { CancellableOperation, TimeoutOptions } from '../utils/withTimeout';
import type { LibraryAlertCopy } from './useLibraryAlerts';

export interface MetadataRefreshGeneration {
  controller: AbortController;
  id: number;
}

export type TimeoutRunner = <T>(operation: Promise<T> | CancellableOperation<T>, timeoutMs: number, timeoutMessage: string, options?: TimeoutOptions) => Promise<T>;

export type MetadataRefreshSongsResult = Awaited<ReturnType<typeof refreshSongsFromId3>>;

export interface UseLibraryMetadataRefreshActionsOptions {
  songs: Song[];
  setSongs: (songs: Song[]) => void;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setImportStatus: Dispatch<SetStateAction<string | null>>;
  showAlert: (alert: LibraryAlertCopy) => void;
  importTimeoutMs?: number;
  refreshSongsFromId3Impl?: typeof refreshSongsFromId3;
  withTimeoutImpl?: TimeoutRunner;
}

export interface UseLibraryMetadataRefreshActionsResult {
  refreshMetadataFromFiles: () => Promise<void>;
}
