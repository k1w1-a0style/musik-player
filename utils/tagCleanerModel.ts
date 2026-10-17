import type { CleanerField, CleanerJournal, CleanerJournalEntry, CleanerMode, CleanerProcess, CleanerRow } from '../types/TagCleaner';
import { selectedCleanerTags, cleanerRowStatus } from './tagCleanerRules';

export const selectSafeCleanerChanges = (rows: readonly CleanerRow[], visibleIds?: readonly string[]): CleanerRow[] => {
  const scope = visibleIds ? new Set(visibleIds) : undefined;
  return rows.map(row => scope && !scope.has(row.song.id) ? row : ({ ...row,
    changes: row.changes.map(change => ({ ...change, selected: change.confidence === 'safe' && !change.previewOnly })),
  }));
};
export const restrictCleanerFields = (rows: readonly CleanerRow[], fields: readonly CleanerField[], mode:CleanerMode='display'): CleanerRow[] => {
  const allowed = new Set<string>(fields);
  return rows.map(row => {
    const changes=row.changes.filter(change=>change.previewOnly||allowed.has(change.field));
    return {...row,changes,status:cleanerRowStatus(changes,row.original,row.writable,mode)};
  });
};
export const selectedCleanerRows = (rows: readonly CleanerRow[]): CleanerRow[] =>
  rows.filter(row => Object.keys(selectedCleanerTags(row)).length > 0);

const needsRecovery = (entry:CleanerJournalEntry):boolean => entry.status==='pending'||entry.status==='interrupted'
  || entry.writeResult?.recoveryPending===true || entry.writeResult?.cleanupPending===true
  || (entry.mode==='file'&&entry.status==='failed'&&!!entry.operationId);
export const cleanerJournalCounts = (journal: CleanerJournal) => journal.entries.reduce((counts,entry)=>({
  confirmed:counts.confirmed+Number(entry.status==='written'||entry.status==='displayed'),
  failed:counts.failed+Number(entry.status==='failed'),recoveryPending:counts.recoveryPending||needsRecovery(entry),
}),{confirmed:0,failed:0,recoveryPending:false});

/** The batch emits one durable entry ACK at a time; avoid rescanning its whole journal per ACK. */
export const advanceCleanerProcess=(current:CleanerProcess,finished:number,total:number,journal:CleanerJournal):CleanerProcess=>{
  if(finished<=current.completed)return current;
  const entry=journal.entries[finished-1];
  return {...current,completed:finished,total,confirmed:current.confirmed+Number(entry.status==='written'||entry.status==='displayed'),
    failed:current.failed+Number(entry.status==='failed'),recoveryPending:current.recoveryPending||needsRecovery(entry)};
};
export const finishCleanerProcess=(current:CleanerProcess,journal:CleanerJournal,cancelled:boolean):CleanerProcess=>{
  const counts=cleanerJournalCounts(journal);
  return {...current,...counts,phase:cancelled?'cancelled':counts.failed||counts.recoveryPending?'failed':'complete'};
};
