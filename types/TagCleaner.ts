import type { EditableTrackTags, WriteTagsResult } from './TagEdit';
import type { Song } from './Song';
export type CleanerField = keyof EditableTrackTags;
export type CleanerConfidence = 'safe' | 'review' | 'uncertain';
export type CleanerRowStatus = 'clean' | 'proposal' | 'readonly' | 'conflict' | 'unreadable';
export type CleanerMode = 'display' | 'file';
export interface CleanerRules {
  whitespace: boolean; assignment: boolean; numbers: boolean; consistency: boolean;
  urlSuffix: boolean; filenames: boolean; privateUrls: boolean;
}
export interface CleanerInventory { id: string; count: number; values?: string[] }
/** Raw file truth. A failed or partial read cannot authorize a file mutation. */
export interface CleanerSnapshot {
  tags: EditableTrackTags; inventory: CleanerInventory[]; verified: boolean;
  error?: string; originalSize?: number; originalSha256?: string;
}
export interface CleanerChange {
  field: CleanerField | 'filename' | 'website' | 'folder'; before: string; after: string;
  confidence: CleanerConfidence; reason: string; selected: boolean; confirmed: boolean;
  previewOnly: boolean;
}
export interface CleanerRow {
  song: Song; sourceKey: string; original: CleanerSnapshot; displayBefore: EditableTrackTags;
  changes: CleanerChange[]; status: CleanerRowStatus; writable: boolean; notes: string[];
}
export interface CleanerJournalEntry {
  songId: string; sourceKey: string; before: EditableTrackTags; after: EditableTrackTags;
  mode: CleanerMode; status: 'planned' | 'pending' | 'displayed' | 'written' | 'skipped' | 'failed' | 'interrupted';
  error?: string; operationId?: string; writeResult?: WriteTagsResult;
}
export interface CleanerJournal { version: 1; id: string; createdAt: number; entries: CleanerJournalEntry[] }

export interface CleanerProcess {
  operation?: 'analysis' | 'apply';
  phase: 'idle' | 'reading' | 'applying' | 'complete' | 'cancelled' | 'failed';
  completed: number; total: number; confirmed: number; failed: number;
  cancelRequested: boolean; recoveryPending: boolean; currentDisplayLabel?: string; startedAt?: number;
}
