import { useSyncExternalStore } from 'react';
import type { ImportFileProgress } from './libraryImportProgress';
import type { ImportScanResult } from './mediaLibraryImport';

export type LibraryScanStatus = 'idle' | 'running' | 'completed' | 'partial' | 'cancelled' | 'failed';
export interface LibraryScanOperation {
  id: number;
  fullScan: boolean;
  status: LibraryScanStatus;
  progress?: ImportFileProgress;
  remainingCount?: number;
}
let state: LibraryScanOperation = { id: 0, fullScan: false, status: 'idle' };
let nextId = 0;
let pending: ImportFileProgress | undefined;
let resultStatus: 'completed' | 'partial' | undefined;
const listeners = new Set<() => void>();
const publish = (next: LibraryScanOperation): void => { state = next; listeners.forEach(listener => listener()); };
const current = (id: number | undefined): boolean => id === state.id && state.status === 'running';
const subscribe = (listener: () => void): (() => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getLibraryScanOperation = (): LibraryScanOperation => state;
export const useLibraryScanOperation = (): LibraryScanOperation => useSyncExternalStore(subscribe, getLibraryScanOperation, getLibraryScanOperation);

export const beginLibraryScan = (fullScan: boolean): number => {
  pending = undefined; resultStatus = undefined;
  const id = ++nextId;
  publish({ id, fullScan, status: 'running' });
  return id;
};

/** Capture every outcome internally; the existing UI publisher bounds notifications. */
export const updateLibraryScanProgress = (id: number | undefined, progress: ImportFileProgress, notify = true): void => {
  if (!current(id)) return;
  pending = progress;
  if (notify) publish({ ...state, progress });
};

export const recordLibraryScanResult = (id: number | undefined,
  result: Pick<ImportScanResult, 'statistics' | 'completed' | 'remainingCount'>): void => {
  if (!current(id) || !result.statistics) return;
  resultStatus = result.completed === false ? 'partial' : 'completed';
  const progress = { processed: 0, total: 0, currentTitle: '', ...pending, statistics: result.statistics };
  pending = progress;
  publish({ ...state, progress, remainingCount: result.remainingCount });
};

export const completeLibraryScan = (id: number | undefined): void => {
  if (!current(id)) return;
  publish({ ...state, progress: pending, status: resultStatus ?? 'idle' });
};

export const stopLibraryScan = (id: number | undefined, status: 'cancelled' | 'failed'): void => {
  if (!current(id)) return;
  publish({ ...state, progress: pending, status });
};

export const dismissLibraryScan = (): void => {
  if (state.status === 'running') return;
  pending = undefined; resultStatus = undefined;
  publish({ id: state.id, fullScan: false, status: 'idle' });
};
