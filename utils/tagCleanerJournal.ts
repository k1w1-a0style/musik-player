import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CleanerJournal, CleanerJournalEntry } from '../types/TagCleaner';
import { CLEANER_FIELDS } from './tagCleanerFieldRules';
const JOURNAL_KEY = 'tag-cleaner-journal-v1';
const MAX_JOURNAL_LENGTH = 4 * 1024 * 1024;
const statuses: CleanerJournalEntry['status'][] = ['planned','pending','displayed','written','skipped','failed','interrupted'];
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const validTags = (value: unknown): boolean => object(value)
  && Object.entries(value).every(([key,text]) => CLEANER_FIELDS.includes(key as typeof CLEANER_FIELDS[number]) && typeof text === 'string' && text.length <= 65536);
const validEntry = (value: unknown): value is CleanerJournalEntry => {
  if (!object(value)) return false;
  return typeof value.songId === 'string' && typeof value.sourceKey === 'string'
    && validTags(value.before) && validTags(value.after)
    && (value.mode === 'display' || value.mode === 'file') && statuses.includes(value.status as CleanerJournalEntry['status']);
};
export const parseCleanerJournal = (raw: string): CleanerJournal => {
  if (raw.length > MAX_JOURNAL_LENGTH) throw new Error('Cleaner-Journal überschreitet Größenlimit.');
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.version !== 1 || typeof value.id !== 'string' || !Number.isSafeInteger(value.createdAt)
    || !Array.isArray(value.entries) || value.entries.length > 10000 || !value.entries.every(validEntry))
    throw new Error('Cleaner-Journal ungültig: keine Wiederholung von Schreiboperationen.');
  return value as unknown as CleanerJournal;
};
let currentJournalEpoch: string | undefined;
let journalChain: Promise<void> = Promise.resolve();
/** Serialize complete transactions, including reads and epoch validation. */
const serialized = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = journalChain.catch(() => undefined).then(operation);
  journalChain = result.then(() => undefined, () => undefined);
  return result;
};
const persistConfirmed = async (key: string, raw: string): Promise<void> => {
  await AsyncStorage.setItem(key, raw);
  if (await AsyncStorage.getItem(key) !== raw)
    throw new Error('Cleaner-Journal wurde nicht bestätigt gespeichert.');
};
const entryKey = (id: string, index: number): string => `tag-cleaner-entry-v1:${id}:${index}`;
const RETAINED_PREFIX = 'tag-cleaner-retained-v1:';
const isCollectable = (journal: CleanerJournal): boolean => journal.entries.every(entry => {
  if (!['displayed', 'written', 'skipped'].includes(entry.status)) return false;
  if (entry.mode === 'display') return !entry.operationId && !entry.writeResult;
  if (entry.status === 'skipped' && !entry.operationId && !entry.writeResult) return true;
  const result = entry.writeResult;
  return result?.terminal === true && result.operationStatus === 'completed' && result.recoveryPending !== true
    && (result.status === 'written' || result.status === 'noop');
});
/** Receipts remain durable until every derived delta key has confirmed deletion.
 * Never infer completion from orphan keys: legacy/unresolved recovery evidence stays.
 */
const collectRetained = async (): Promise<void> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(RETAINED_PREFIX));
  for (const key of keys) {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) throw new Error('Cleaner-Retention nicht bestätigt.');
    const journal = parseCleanerJournal(raw);
    if (key !== RETAINED_PREFIX + journal.id) throw new Error('Cleaner-Retention falsch zugeordnet.');
    if (!isCollectable(journal)) continue;
    for (let start = 0; start < journal.entries.length; start += 100) {
      const records = journal.entries.slice(start, start + 100).map((_, offset) => entryKey(journal.id, start + offset));
      await AsyncStorage.multiRemove(records);
      const remaining = await AsyncStorage.multiGet(records);
      if (remaining.length !== records.length || remaining.some(([name, value], index) => name !== records[index] || value !== null))
        throw new Error('Cleaner-Journal Löschung nicht bestätigt.');
    }
    await AsyncStorage.removeItem(key);
    if (await AsyncStorage.getItem(key) !== null) throw new Error('Cleaner-Retention Löschung nicht bestätigt.');
  }
};
export const saveCleanerJournalEntry = (journal: CleanerJournal, index: number): Promise<void> => {
  const entry = journal.entries[index];
  if (!validEntry(entry)) throw new Error('Cleaner-Journaleintrag ungültig.');
  const raw = JSON.stringify({version:1,journalId:journal.id,index,entry});
  return serialized(async () => {
    if (currentJournalEpoch !== journal.id) throw new Error('Cleaner-Journalepoch wurde abgelöst.');
    if (raw.length > MAX_JOURNAL_LENGTH) throw new Error('Cleaner-Journal überschreitet Größenlimit.');
    await persistConfirmed(entryKey(journal.id, index), raw);
  });
};
export const saveCleanerJournal = (journal: CleanerJournal): Promise<void> => {
  const raw = JSON.stringify(journal);
  parseCleanerJournal(raw);
  return serialized(async () => {
    const previous = await readCleanerJournal();
    if (previous?.id !== journal.id && await AsyncStorage.getItem(RETAINED_PREFIX + journal.id) !== null)
      throw new Error('Cleaner-Journalepoch besitzt noch Recovery-Evidenz.');
    if (previous && previous.id !== journal.id) {
      const key = RETAINED_PREFIX + previous.id;
      const snapshot = JSON.stringify(previous);
      const retained = await AsyncStorage.getItem(key);
      if (retained !== null && retained !== snapshot) throw new Error('Cleaner-Retention widersprüchlich.');
      await persistConfirmed(key, snapshot);
    }
    await persistConfirmed(JOURNAL_KEY, raw);
    currentJournalEpoch = journal.id;
    await collectRetained();
  });
};
const readCleanerJournal = async (): Promise<CleanerJournal | undefined> => {
  const raw = await AsyncStorage.getItem(JOURNAL_KEY);
  if (raw === null) return undefined;
  const journal = parseCleanerJournal(raw);
  for (let start=0;start<journal.entries.length;start+=100) {
    const keys=journal.entries.slice(start,start+100).map((_,offset)=>entryKey(journal.id,start+offset));
    const records=await AsyncStorage.multiGet(keys);
    if (records.length!==keys.length) throw new Error('Cleaner-Journalread unvollständig.');
    records.forEach(([key,record],offset)=>{
      if (key!==keys[offset]) throw new Error('Cleaner-Journalread falsch zugeordnet.');
      if (record===null) return;
      if (record.length > MAX_JOURNAL_LENGTH) throw new Error('Cleaner-Journal überschreitet Größenlimit.');
      const value: unknown=JSON.parse(record);
      if (!object(value) || value.version!==1 || value.journalId!==journal.id || value.index!==start+offset) throw new Error('Cleaner-Journalepoch nicht bestätigt.');
      const entry=value.entry;
      const original=journal.entries[start+offset];
      if (!validEntry(entry) || entry.songId!==original.songId || entry.sourceKey!==original.sourceKey || entry.mode!==original.mode)
        throw new Error('Cleaner-Journalrecord nicht bestätigt.');
      journal.entries[start+offset]=entry;
    });
  }
  return parseCleanerJournal(JSON.stringify(journal));
};
export const loadCleanerJournal = (): Promise<CleanerJournal | undefined> => serialized(async () => {
  const journal = await readCleanerJournal();
  if (!journal) { currentJournalEpoch = undefined; return undefined; }
  currentJournalEpoch = journal.id;
  return { ...journal, entries: journal.entries.map(entry => entry.status === 'pending' || entry.status === 'planned'
    ? { ...entry, status: 'interrupted', error: 'Unterbrochener Lauf. Natives Recovery und Quellen erneut prüfen; keine automatische Wiederholung.' } : entry) };
});
