import type { CleanerJournal, CleanerJournalEntry } from '../types/TagCleaner';
import type { CleanerExecutionInput } from './tagCleanerExecutionTypes';
import { selectedCleanerTags } from './tagCleanerRules';
import { executeCleanerRow } from './tagCleanerExecuteRow';
import { saveCleanerJournal, saveCleanerJournalEntry } from './tagCleanerJournal';
const runCleanerBatch = async ({rows,options}: CleanerExecutionInput): Promise<CleanerJournal> => {
  const selected = rows.filter(row => Object.keys(selectedCleanerTags(row)).length > 0);
  const journal: CleanerJournal = { version:1,id:`cleaner-${Date.now()}-${Math.random().toString(36).slice(2,10)}`,createdAt:Date.now(),entries:selected.map(row => ({
    songId:row.song.id,sourceKey:row.sourceKey,before:options.mode === 'file' ? row.original.tags : row.displayBefore,
    after:selectedCleanerTags(row),mode:options.mode,status:'planned',
  })) };
  const save = options.saveJournal ?? saveCleanerJournal;
  const saveEntry = options.saveJournal ? async (_index:number) => save(journal) : async (index:number) => saveCleanerJournalEntry(journal,index);
  await save(journal);
  for (let index=0;index<selected.length;index+=1) {
    if (options.cancelled()) break;
    const entry:CleanerJournalEntry=journal.entries[index];
    entry.status='pending';
    await saveEntry(index);
    await executeCleanerRow(selected[index],options,entry);
    await saveEntry(index);
    options.onProgress?.(index+1,selected.length,journal);
    if (entry.status === 'pending' || entry.status === 'failed') break;
    await new Promise<void>(resolve => setTimeout(resolve,0));
  }
  for (const entry of journal.entries) if (entry.status === 'planned') {entry.status='skipped';entry.error='Lauf beendet oder zwischen Dateien abgebrochen.';}
  await save(journal);
  return journal;
};

let activeCleanerBatch=false;
export const executeCleanerBatch = async (input: CleanerExecutionInput): Promise<CleanerJournal> => {
  if (activeCleanerBatch) throw new Error('Ein Cleaner-Lauf ist bereits aktiv.');
  activeCleanerBatch=true;
  try { return await runCleanerBatch(input); }
  finally { activeCleanerBatch=false; }
};
