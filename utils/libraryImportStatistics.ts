import type { Song } from '../types/Song';
import { compareImportFileRevision, type ImportFileRevision } from './importFileRevision';

export type ImportSourceOutcome = 'new' | 'changed' | 'unchanged' | 'unverified' | 'duplicate';
export interface ImportSourceDecision { include: boolean; outcome: ImportSourceOutcome; unverified: boolean }
export interface ImportScanStatistics {
  newCount: number;
  changedCount: number;
  unchangedCount: number;
  unverifiedCount: number;
  duplicateCount: number;
  /** Distinct files/directories with a read problem, including recoverable errors. */
  errorCount: number;
}

export const emptyImportScanStatistics = (): ImportScanStatistics => ({ newCount: 0, changedCount: 0,
  unchangedCount: 0, unverifiedCount: 0, duplicateCount: 0, errorCount: 0 });

export const isNewerThanImport = (previous: Song | undefined, revision?: ImportFileRevision): boolean =>
  previous?.fileInfo?.modificationTime === undefined
  && (revision?.modificationTime ?? 0) > (previous?.fileInfo?.importedAt ?? Infinity);

export const classifyImportSource = (previous: Song | undefined, revision: ImportFileRevision | undefined,
  fullScan: boolean): ImportSourceOutcome => {
  if (!previous) return 'new';
  const comparison = revision ? compareImportFileRevision(previous.fileInfo ?? {}, revision) : 'unknown';
  if (comparison === 'changed' || (comparison === 'unknown' && isNewerThanImport(previous, revision))) return 'changed';
  if (comparison === 'same' && (!fullScan || revision?.contentHash)) return 'unchanged';
  return 'unverified';
};

/** Unverified content can overlap a successful new/changed import in a full scan. */
export const countImportSourceOutcome = (statistics: ImportScanStatistics, decision: ImportSourceDecision): void => {
  if (decision.outcome === 'new') statistics.newCount += 1;
  else if (decision.outcome === 'changed') statistics.changedCount += 1;
  else if (decision.outcome === 'unchanged') statistics.unchangedCount += 1;
  else if (decision.outcome === 'duplicate') statistics.duplicateCount += 1;
  if (decision.unverified) statistics.unverifiedCount += 1;
};
