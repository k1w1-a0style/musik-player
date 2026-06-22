import { useSyncExternalStore } from 'react';
import type { SongMetadataRefreshError } from './songMetadataRefresh';

/**
 * Persistent operation state for the manual metadata refresh.
 *
 * Lives in an external store (not just useRef), so the UI keeps a stable view
 * across re-renders, mount/unmount, and a fresh tap on "Metadaten aktualisieren".
 * It tracks the status machine (idle -> running -> cancelling -> cancelled/
 * resumable/completed/failed), live counters, the per-track error list, and the
 * resume index so a user-triggered cancel or soft-budget timeout can be
 * continued exactly where it stopped.
 */
export type MetadataRefreshStatus =
  | 'idle'
  | 'running'
  | 'cancelling'
  | 'cancelled'
  | 'resumable'
  | 'partial'
  | 'completed'
  | 'failed';

export interface MetadataRefreshOperationState {
  operationId: string | null;
  status: MetadataRefreshStatus;
  total: number;
  processed: number;
  resumeIndex: number;
  processedIndexes: number[];
  updated: number;
  skipped: number;
  failed: number;
  errorDetails: SongMetadataRefreshError[];
  lastProcessedSongId?: string;
  startedAt?: number;
  updatedAt?: number;
}

const initialState: MetadataRefreshOperationState = {
  operationId: null,
  status: 'idle',
  total: 0,
  processed: 0,
  resumeIndex: 0,
  processedIndexes: [],
  updated: 0,
  skipped: 0,
  failed: 0,
  errorDetails: [],
};

let state: MetadataRefreshOperationState = initialState;
const listeners = new Set<() => void>();

const notify = (): void => {
  listeners.forEach(listener => listener());
};

const setState = (next: MetadataRefreshOperationState): void => {
  if (Object.is(next, state)) return;
  state = next;
  notify();
};

const generateOperationId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const getMetadataRefreshOperationState = (): MetadataRefreshOperationState => state;

export const subscribeMetadataRefreshOperation = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useMetadataRefreshOperation = (): MetadataRefreshOperationState =>
  useSyncExternalStore(subscribeMetadataRefreshOperation, getMetadataRefreshOperationState, getMetadataRefreshOperationState);

export const beginMetadataRefreshOperation = (total: number, resumeIndex: number): string => {
  const operationId = state.operationId && state.status === 'resumable' ? state.operationId : generateOperationId();
  const now = Date.now();
  setState({
    ...state,
    operationId,
    status: 'running',
    total,
    resumeIndex,
    // Preserve counters/errors if we are continuing the same operation, otherwise reset.
    processed: operationId === state.operationId ? state.processed : 0,
    processedIndexes: operationId === state.operationId ? state.processedIndexes : [],
    updated: operationId === state.operationId ? state.updated : 0,
    skipped: operationId === state.operationId ? state.skipped : 0,
    failed: operationId === state.operationId ? state.failed : 0,
    errorDetails: operationId === state.operationId ? state.errorDetails : [],
    lastProcessedSongId: operationId === state.operationId ? state.lastProcessedSongId : undefined,
    startedAt: operationId === state.operationId ? (state.startedAt ?? now) : now,
    updatedAt: now,
  });
  return operationId;
};

export const updateMetadataRefreshProgress = (patch: {
  processed?: number;
  total?: number;
  updated?: number;
  skipped?: number;
  failed?: number;
  resumeIndex?: number;
  processedIndexes?: number[];
  errorDetails?: SongMetadataRefreshError[];
  lastProcessedSongId?: string;
}): void => {
  setState({
    ...state,
    ...(patch.processed !== undefined ? { processed: patch.processed } : {}),
    ...(patch.total !== undefined ? { total: patch.total } : {}),
    ...(patch.updated !== undefined ? { updated: patch.updated } : {}),
    ...(patch.skipped !== undefined ? { skipped: patch.skipped } : {}),
    ...(patch.failed !== undefined ? { failed: patch.failed } : {}),
    ...(patch.resumeIndex !== undefined ? { resumeIndex: patch.resumeIndex } : {}),
    ...(patch.processedIndexes !== undefined ? { processedIndexes: patch.processedIndexes } : {}),
    ...(patch.errorDetails !== undefined ? { errorDetails: patch.errorDetails } : {}),
    ...(patch.lastProcessedSongId !== undefined ? { lastProcessedSongId: patch.lastProcessedSongId } : {}),
    updatedAt: Date.now(),
  });
};

export const markMetadataRefreshCancelling = (): void => {
  if (state.status !== 'running') return;
  setState({ ...state, status: 'cancelling', updatedAt: Date.now() });
};

export const completeMetadataRefreshOperation = (outcome: 'completed' | 'cancelled' | 'resumable' | 'partial' | 'failed'): void => {
  if (outcome === 'completed') {
    setState({ ...initialState, status: 'completed', updatedAt: Date.now() });
    return;
  }
  setState({ ...state, status: outcome, updatedAt: Date.now() });
};

export const resetMetadataRefreshOperationForTests = (): void => {
  state = initialState;
  listeners.clear();
};

export const canResumeMetadataRefresh = (snapshot: MetadataRefreshOperationState = state): boolean =>
  (snapshot.status === 'resumable' || snapshot.status === 'partial' || snapshot.status === 'cancelled')
  && snapshot.total > 0
  && snapshot.resumeIndex < snapshot.total;
