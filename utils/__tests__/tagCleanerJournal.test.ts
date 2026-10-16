import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CleanerJournal } from '../../types/TagCleaner';
import { loadCleanerJournal, saveCleanerJournal, saveCleanerJournalEntry } from '../tagCleanerJournal';
const header = 'tag-cleaner-journal-v1';
const record = (id: string) => `tag-cleaner-entry-v1:${id}:0`;
const retained = (id: string) => `tag-cleaner-retained-v1:${id}`;
const journal = (id: string, status: CleanerJournal['entries'][number]['status'] = 'planned'): CleanerJournal => ({
 version: 1, id, createdAt: 1, entries: [{songId: id, sourceKey: `content://synthetic/${id}`, before: {title: ' x '}, after: {title: 'x'}, mode: 'display', status}],
});
beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); });
test('24 completed batches keep bounded storage and the current durable result', async () => {
 for (let i = 0; i < 24; i++) {
  const run = journal(`run-${i}`); await saveCleanerJournal(run);
  run.entries[0].status = 'pending'; await saveCleanerJournalEntry(run, 0);
  run.entries[0].status = 'displayed'; await saveCleanerJournalEntry(run, 0); await saveCleanerJournal(run);
 }
 expect(await AsyncStorage.getAllKeys()).toEqual(expect.arrayContaining([header, record('run-23')]));
 expect((await AsyncStorage.getAllKeys()).length).toBe(2);
 expect((await loadCleanerJournal())?.entries[0].status).toBe('displayed');
});
test.each(['pending', 'planned', 'interrupted', 'failed'] as const)('retains incomplete old epoch %s across later completed runs and reload', async status => {
 const old = journal('old', status); await saveCleanerJournal(old); await saveCleanerJournalEntry(old, 0);
 await saveCleanerJournal(journal('next', 'displayed'));
 expect(JSON.parse((await AsyncStorage.getItem(retained('old')))!)).toEqual(old);
 expect(await AsyncStorage.getItem(record('old'))).not.toBeNull();
 await saveCleanerJournal(journal('last', 'displayed')); await loadCleanerJournal();
 expect(await AsyncStorage.getItem(retained('old'))).not.toBeNull();
});
test('pending native SAF evidence is retained even when the row claims written', async () => {
 const old = journal('native', 'written'); old.entries[0].mode = 'file'; old.entries[0].operationId = 'native-operation';
 old.entries[0].writeResult = {status: 'writeFailed', warnings: [], terminal: false, operationStatus: 'pending', recoveryPending: true};
 await saveCleanerJournal(old); await saveCleanerJournalEntry(old, 0); await saveCleanerJournal(journal('next'));
 expect(JSON.parse((await AsyncStorage.getItem(retained('native')))!)).toEqual(old);
 expect(await AsyncStorage.getItem(record('native'))).not.toBeNull();
});
test('confirmed complete native rows are collectable; unrelated and unproven legacy records survive', async () => {
 const old = journal('native', 'written'); old.entries[0].mode = 'file';
 old.entries[0].writeResult = {status: 'written', warnings: [], terminal: true, operationStatus: 'completed'};
 await saveCleanerJournal(old); await saveCleanerJournalEntry(old, 0);
 await AsyncStorage.setItem(record('unproven-legacy'), 'legacy recovery evidence');
 await AsyncStorage.setItem('tag-write-recovery', 'native recovery');
 await saveCleanerJournal(journal('next'));
 expect(await AsyncStorage.getItem(record('native'))).toBeNull();
 expect(await AsyncStorage.getItem(record('unproven-legacy'))).toBe('legacy recovery evidence');
 expect(await AsyncStorage.getItem('tag-write-recovery')).toBe('native recovery');
});
test('failed deletion rejects, preserves its durable collection receipt and can retry after reload', async () => {
 const old = journal('done', 'displayed'); await saveCleanerJournal(old); await saveCleanerJournalEntry(old, 0);
 (AsyncStorage.multiRemove as jest.Mock).mockRejectedValueOnce(new Error('disk failure'));
 await expect(saveCleanerJournal(journal('next'))).rejects.toThrow('disk failure');
 expect(await AsyncStorage.getItem(retained('done'))).not.toBeNull();
 await loadCleanerJournal(); await saveCleanerJournal(journal('next'));
 expect(await AsyncStorage.getItem(retained('done'))).toBeNull();
 expect(await AsyncStorage.getItem(record('done'))).toBeNull();
});
test('unconfirmed deletion and archive persistence fail closed before discarding evidence', async () => {
 const old = journal('done', 'displayed'); await saveCleanerJournal(old); await saveCleanerJournalEntry(old, 0);
 (AsyncStorage.multiRemove as jest.Mock).mockResolvedValueOnce(undefined);
 await expect(saveCleanerJournal(journal('next'))).rejects.toThrow('Löschung');
 expect(await AsyncStorage.getItem(retained('done'))).not.toBeNull();
 (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('full'));
 await expect(saveCleanerJournal(journal('other'))).rejects.toThrow('full');
 expect(JSON.parse((await AsyncStorage.getItem(header))!).id).toBe('next');
});
test('epoch validation occurs inside the queue, and queued writes cannot revive an old epoch', async () => {
 const old = journal('old'); await saveCleanerJournal(old);
 const replacement = saveCleanerJournal(journal('new'));
 const stale = saveCleanerJournalEntry(old, 0);
 await replacement; await expect(stale).rejects.toThrow('abgelöst');
 expect(await AsyncStorage.getItem(record('old'))).toBeNull();
 expect((await loadCleanerJournal())?.id).toBe('new');
});
test('malformed/oversized retained snapshots fail closed without deleting their records', async () => {
 await saveCleanerJournal(journal('current'));
 for (const bad of ['{}', 'x'.repeat(4 * 1024 * 1024 + 1)]) {
  await AsyncStorage.setItem(retained('bad'), bad); await AsyncStorage.setItem(record('bad'), 'evidence');
  await expect(saveCleanerJournal(journal('current'))).rejects.toThrow();
  expect(await AsyncStorage.getItem(record('bad'))).toBe('evidence');
 }
});
test('unconfirmed receipt deletion fails closed and retries without losing an incomplete epoch', async () => {
 const pending = journal('pending', 'pending'); await saveCleanerJournal(pending); await saveCleanerJournalEntry(pending, 0);
 const done = journal('done', 'displayed'); await saveCleanerJournal(done); await saveCleanerJournalEntry(done, 0);
 (AsyncStorage.removeItem as jest.Mock).mockResolvedValueOnce(undefined);
 await expect(saveCleanerJournal(journal('next'))).rejects.toThrow('Retention Löschung');
 expect(await AsyncStorage.getItem(retained('done'))).not.toBeNull();
 expect(await AsyncStorage.getItem(retained('pending'))).not.toBeNull();
 await saveCleanerJournal(journal('next'));
 expect(await AsyncStorage.getItem(retained('done'))).toBeNull();
 expect(await AsyncStorage.getItem(record('pending'))).not.toBeNull();
});
test('cannot reuse an epoch id carrying unresolved recovery evidence', async () => {
 await saveCleanerJournal(journal('pending', 'pending')); await saveCleanerJournal(journal('other'));
 await expect(saveCleanerJournal(journal('pending', 'displayed'))).rejects.toThrow('Recovery-Evidenz');
 expect(JSON.parse((await AsyncStorage.getItem(header))!).id).toBe('other');
});
test('completed native write with pending cleanup still retains its recovery/backup evidence', async () => {
 const old = journal('cleanup-pending', 'written'); old.entries[0].mode = 'file';
 old.entries[0].operationId = 'committed-with-backup';
 old.entries[0].writeResult = {status:'written',warnings:['Backup cleanup pending'],terminal:true,operationStatus:'completed',recoveryPending:false,cleanupPending:true,backupUri:'content://synthetic/backup'};
 await saveCleanerJournal(old); await saveCleanerJournalEntry(old,0);
 await saveCleanerJournal(journal('next'));
 expect(JSON.parse((await AsyncStorage.getItem(retained('cleanup-pending')))!)).toEqual(old);
 expect(await AsyncStorage.getItem(record('cleanup-pending'))).not.toBeNull();
});
