import type { Song } from '../types/Song';
import type { TagEditDraft, WriteTagsResult } from '../types/TagEdit';
import type { CleanerMode, CleanerRow, CleanerJournal } from '../types/TagCleaner';
import type { CleanerReadAdapter } from './tagCleanerReadTypes';
import type { WriteTagsOptions } from './tagWriterPublicApi';
export interface CleanerExecutionOptions {
  mode: CleanerMode; getSongs: () => readonly Song[]; cancelled: () => boolean;
  /** Must resolve only after the Library checkpoint is confirmed durable. */
  updateSong: (id: string, patch: Partial<Song>) => Promise<void>;
  saveJournal?: (journal: CleanerJournal) => Promise<void>;
  readAdapter?: CleanerReadAdapter;
  write?: (song: Song, draft: TagEditDraft, options: WriteTagsOptions) => Promise<WriteTagsResult>;
  queueReason?: (song: Song, songs: readonly Song[]) => Promise<string | undefined>;
  onProgress?: (finished: number, total: number, journal: CleanerJournal) => void;
}
export interface CleanerExecutionInput { rows: readonly CleanerRow[]; options: CleanerExecutionOptions }
