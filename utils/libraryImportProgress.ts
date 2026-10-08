import { useSyncExternalStore } from 'react';
import { countImportSourceOutcome, emptyImportScanStatistics, type ImportScanStatistics, type ImportSourceDecision } from './libraryImportStatistics';

export interface ImportFileProgress {
  processed: number;
  total: number;
  currentTitle: string;
  statistics?: ImportScanStatistics;
}

const idle: ImportFileProgress = { processed: 0, total: 0, currentTitle: '' };
let state = idle;
const listeners = new Set<() => void>();
export const publishImportFileProgress = (next: ImportFileProgress): void => {
  state = next;
  listeners.forEach(listener => listener());
};
export const clearImportFileProgress = (): void => publishImportFileProgress(idle);
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const useImportFileProgress = (): ImportFileProgress =>
  useSyncExternalStore(subscribe, () => state, () => state);

const titleFromUri = (uri: string): string => {
  try { uri = decodeURIComponent(uri); } catch { /* Use the provider's name. */ }
  return uri.split('/').pop() ?? uri;
};

/** Concurrent readers share counters and keep a currently active title visible. */
export const createImportFileProgressReporter = (
  onProgress?: (progress: ImportFileProgress) => void,
  signal?: AbortSignal,
  trackStatistics = false,
) => {
  let total = 0;
  let processed = 0;
  const active = new Set<string>();
  const statistics = emptyImportScanStatistics();
  const publish = (): void => {
    if (!signal?.aborted) onProgress?.({ total, processed,
      currentTitle: titleFromUri(active.values().next().value ?? ''),
      ...(trackStatistics ? { statistics: { ...statistics } } : {}) });
  };
  return {
    addFiles: (count: number): void => { total += count; publish(); },
    start: (uri: string): void => { active.add(uri); publish(); },
    finish: (uri: string, decision?: ImportSourceDecision): void => {
      active.delete(uri);
      if (decision) countImportSourceOutcome(statistics, decision);
      processed += 1; publish();
    },
    errors: (count: number): void => { statistics.errorCount = count; publish(); },
    getStatistics: (): ImportScanStatistics => ({ ...statistics }),
  };
};
