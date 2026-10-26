import { appendScanProgress, sumScanStatistics } from './libraryScanAggregation';
import type { LibraryScanSource } from './libraryScanSources';
import { useSyncExternalStore } from 'react';
import type { ImportFileProgress } from './libraryImportProgress';
import type { ImportScanResult } from './mediaLibraryImport';

export type LibraryScanStatus = 'idle' | 'running' | 'completed' | 'partial' | 'cancelled' | 'failed';
export interface LibraryScanOperation {
  id: number;
  fullScan: boolean;
  source?: LibraryScanSource;
  diagnostics?: ImportScanResult['diagnostics'];
  errorDetails?: ImportScanResult['errorDetails'];
  status: LibraryScanStatus;
  progress?: ImportFileProgress;
  remainingCount?: number;
  errorMessage?: string;
  folderPersistenceWarning?: {
    message: string;
    retrying: boolean;
    retry: () => Promise<void>;
  };
}
let state: LibraryScanOperation = { id: 0, fullScan: false, status: 'idle' };
let nextId = 0;
let pending: ImportFileProgress | undefined;
let sourceOffset: ImportFileProgress | undefined;
let resultStatus: 'completed' | 'partial' | undefined;
const listeners = new Set<() => void>();
const publish = (next: LibraryScanOperation): void => { state = next; listeners.forEach(listener => listener()); };
const current = (id: number | undefined): boolean => id === state.id && state.status === 'running';
export const subscribeLibraryScanOperation = (listener: () => void): (() => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getLibraryScanOperation = (): LibraryScanOperation => state;
export const useLibraryScanOperation = (): LibraryScanOperation => useSyncExternalStore(subscribeLibraryScanOperation, getLibraryScanOperation, getLibraryScanOperation);

export const beginLibraryScan = (fullScan: boolean, source?: LibraryScanSource): number => {
  pending = undefined; sourceOffset = undefined; resultStatus = undefined;
  const id = ++nextId;
  publish({ id, fullScan, source, status: 'running' });
  return id;
};

/** Capture every outcome internally; the existing UI publisher bounds notifications. */
export const updateLibraryScanProgress = (id: number | undefined, progress: ImportFileProgress, notify = true): void => {
  if (!current(id)) return;
  pending = appendScanProgress(sourceOffset, progress);
  if (notify) publish({ ...state, progress: pending });
};

export const recordLibraryScanResult = (id: number | undefined,
  result: Pick<ImportScanResult, 'statistics' | 'completed' | 'remainingCount' | 'diagnostics' | 'errorDetails'>): void => {
  if (!current(id) || !result.statistics) return;
  resultStatus = result.completed === false || resultStatus === 'partial' ? 'partial' : 'completed';
  const progress = { processed: 0, total: 0, currentTitle: '', ...pending, statistics: sumScanStatistics(sourceOffset?.statistics, result.statistics) };
  pending = progress;
  const old = state.diagnostics;
  const next = result.diagnostics;
  const diagnostics = next ? { directoryErrorCount: (old?.directoryErrorCount ?? 0) + next.directoryErrorCount,
    fileErrorCount: (old?.fileErrorCount ?? 0) + next.fileErrorCount, importedCount: (old?.importedCount ?? 0) + next.importedCount } : old;
  const errorDetails = [...(state.errorDetails ?? []), ...(result.errorDetails ?? [])].slice(0, 20);
  publish({ ...state, progress, diagnostics, ...(errorDetails.length ? { errorDetails } : {}),
    remainingCount: (state.remainingCount ?? 0) + (result.remainingCount ?? 0) });
};

export const completeLibraryScan = (id: number | undefined): void => {
  if (!current(id)) return;
  publish({ ...state, progress: pending, status: state.folderPersistenceWarning ? 'partial' : resultStatus ?? 'idle' });
};

export const setLibraryScanFolderWarning = (id: number | undefined,
  warning?: LibraryScanOperation['folderPersistenceWarning']): void => {
  if (id !== state.id || state.status === 'idle') return;
  const status = state.status === 'partial' && !warning ? resultStatus ?? 'completed' : state.status;
  publish({ ...state, status, folderPersistenceWarning: warning });
};

export const stopLibraryScan = (id: number | undefined, status: 'cancelled' | 'failed', errorMessage?: string): void => {
  if (!current(id)) return;
  publish({ ...state, progress: pending, status, errorMessage });
};

export const dismissLibraryScan = (): void => {
  if (state.status === 'running') return;
  pending = undefined; sourceOffset = undefined; resultStatus = undefined;
  publish({ id: state.id, fullScan: false, status: 'idle' });
};

/** Each selected source owns local counters; the public scan shows their sum. */
export const beginLibraryScanSource = (id: number | undefined): void => {
  if (current(id)) sourceOffset = pending;
};
export const recordLibraryScanSourceFailure = (id: number | undefined, message: string): void => {
  if (!current(id)) return;
  resultStatus = 'partial';
  publish({ ...state, errorMessage: [state.errorMessage, message].filter(Boolean).join('\n') });
};
