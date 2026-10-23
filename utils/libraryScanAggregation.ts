import type { ImportFileProgress } from './libraryImportProgress';
import type { ImportScanStatistics } from './libraryImportStatistics';

export const sumScanStatistics = (left: ImportScanStatistics | undefined, right: ImportScanStatistics): ImportScanStatistics =>
  Object.fromEntries(Object.entries(right).map(([key, value]) =>
    [key, value + (left?.[key as keyof ImportScanStatistics] ?? 0)])) as unknown as ImportScanStatistics;

export const appendScanProgress = (previous: ImportFileProgress | undefined, next: ImportFileProgress): ImportFileProgress => ({
  ...next, processed: (previous?.processed ?? 0) + next.processed, total: (previous?.total ?? 0) + next.total,
  ...(next.statistics ? { statistics: sumScanStatistics(previous?.statistics, next.statistics) } : {}),
});
