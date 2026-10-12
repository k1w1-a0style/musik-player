import type { CleanerJournalEntry, CleanerRow } from '../types/TagCleaner';
import type { Song } from '../types/Song';
import type { EditableTrackTags, WriteTagsResult } from '../types/TagEdit';
import type { CleanerExecutionOptions } from './tagCleanerExecutionTypes';
import { cleanerReadAdapter, readCleanerSnapshot } from './tagCleanerRead';
import { hashCleanerSource } from './tagCleanerSha256';
import { checkCleanerNativeQueue } from './tagCleanerPlayback';
import { writeTagsToFile } from './tagWriterPublicApi';
import { selectedCleanerTags } from './tagCleanerRules';
import { withTimeout } from './withTimeout';
import { getSongSourceKey } from './songSourceIdentity';
const sameSource = (song: Song, row: CleanerRow): boolean => (getSongSourceKey(song.fileInfo?.uri ?? song.uri) ?? `id:${song.id}`) === row.sourceKey;
const sourceBeforeReason = async (row: CleanerRow, song: Song, tags: EditableTrackTags, options: CleanerExecutionOptions): Promise<string | undefined> => {
  const fresh = await readCleanerSnapshot(song, options.readAdapter ?? cleanerReadAdapter);
  if (!fresh.verified) return 'Original-Tags nicht vollständig bestätigt.';
  if (fresh.originalSize !== row.original.originalSize) return 'Originalgröße seit Vorschau geändert.';
  for (const field of Object.keys(tags) as (keyof EditableTrackTags)[]) {
    if (fresh.tags[field] !== row.original.tags[field]) return `Originalfeld ${field} seit Vorschau geändert.`;
  }
  return undefined;
};
const updateConfirmed = async (options: CleanerExecutionOptions, id: string, patch: Partial<Song>): Promise<void> => {
  const ack = options.updateSong(id, patch);
  if (!ack || typeof ack.then !== 'function') throw new Error('Bibliothek-Persistenz-ACK fehlt.');
  await withTimeout(ack, 30000, 'Bibliothek-Persistenz wurde nicht bestätigt.');
};
const writtenPatch = async (row: CleanerRow, song: Song, tags: EditableTrackTags, options: CleanerExecutionOptions): Promise<Partial<Song>> => {
  const fresh = await readCleanerSnapshot(song, options.readAdapter ?? cleanerReadAdapter);
  if (!fresh.verified || Object.entries(tags).some(([field,value]) => fresh.tags[field as keyof EditableTrackTags] !== value))
    throw new Error('Datei geschrieben; Tag-Nachprüfung nicht bestätigt. Keine automatische Wiederholung.');
  const info = await hashCleanerSource(song.fileInfo?.uri ?? song.uri!, options.readAdapter ?? cleanerReadAdapter);
  return { ...tags, fileInfo: { ...song.fileInfo, size: info.size, contentHash: info.sha256, modificationTime: info.modificationTime } };
};
const acceptNativeResult = (result: WriteTagsResult, entry: CleanerJournalEntry): boolean => {
  entry.writeResult=result; entry.operationId=result.operationId;
  if (result.terminal === true && (result.errorCode === 'TransactionConflict' || result.status === 'cancelled')) {
    entry.status='skipped'; entry.error=result.errorMessage; return false;
  }
  if (result.terminal !== true || result.operationStatus !== 'completed' || result.recoveryPending) {
    entry.status=result.terminal === false ? 'pending' : 'failed'; entry.error=result.errorMessage ?? 'Natives Ergebnis nicht bestätigt.'; return false;
  }
  if (result.status !== 'written' && result.status !== 'noop') { entry.status='failed'; entry.error=result.errorMessage; return false; }
  return true;
};
const runFileRow = async (row: CleanerRow, song: Song, tags: EditableTrackTags, options: CleanerExecutionOptions, entry: CleanerJournalEntry): Promise<void> => {
  if (!row.writable || !row.original.verified) { entry.status='skipped'; entry.error='Format, SAF-Rechte oder rohe Original-Tags nicht bestätigt.'; return; }
  const reason = await sourceBeforeReason(row, song, tags, options);
  if (reason) { entry.status='skipped'; entry.error=reason; return; }
  const info = await hashCleanerSource(song.fileInfo?.uri ?? song.uri!, options.readAdapter ?? cleanerReadAdapter);
  const writer = options.write ?? writeTagsToFile;
  const result = await writer(song, {songId:song.id,tags}, {
    expectedOriginalSizeBytes: info.size, expectedOriginalSha256Hex: info.sha256,
    preflight: async () => {
      if (options.cancelled()) return 'Abbruch vor nächster Datei.';
      const current = options.getSongs().find(item => item.id === song.id);
      if (!current || !sameSource(current,row)) return 'Quelle seit Vorschau geändert.';
      const rawReason = await sourceBeforeReason(row,current,tags,options);
      if (rawReason) return rawReason;
      return (options.queueReason ?? checkCleanerNativeQueue)(current, options.getSongs());
    },
  });
  if (!acceptNativeResult(result,entry)) return;
  const patch = await writtenPatch(row,song,tags,options);
  const current = options.getSongs().find(item => item.id === song.id);
  if (!current || !sameSource(current,row)) throw new Error('Datei geschrieben; Bibliotheksquelle inzwischen geändert.');
  if (Object.keys(tags).some(field => current[field as keyof EditableTrackTags] !== row.displayBefore[field as keyof EditableTrackTags]))
    throw new Error('Datei geschrieben; Anzeige inzwischen geändert. Keine Anzeige überschrieben.');
  await updateConfirmed(options,song.id,patch);
  entry.status='written';
};
export const executeCleanerRow = async (row: CleanerRow, options: CleanerExecutionOptions, entry: CleanerJournalEntry): Promise<void> => {
  try {
    const song = options.getSongs().find(item => item.id === row.song.id);
    if (!song || !sameSource(song,row)) { entry.status='skipped'; entry.error='Quelle entfernt oder Identität geändert.'; return; }
    const tags = selectedCleanerTags(row);
    if (options.mode === 'file') { await runFileRow(row,song,tags,options,entry); return; }
    for (const field of Object.keys(tags) as (keyof EditableTrackTags)[]) {
      if (song[field] !== row.displayBefore[field]) { entry.status='skipped'; entry.error='Anzeige seit Vorschau geändert.'; return; }
    }
    await updateConfirmed(options,song.id,tags);
    entry.status='displayed';
  } catch (error) { entry.status='failed'; entry.error=String(error); }
};
