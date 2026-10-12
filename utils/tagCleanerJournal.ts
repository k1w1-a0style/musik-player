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
const persistConfirmed = (key: string, raw: string): Promise<void> => {
  const operation = journalChain.catch(() => undefined).then(async () => {
    await AsyncStorage.setItem(key, raw);
    const saved = await AsyncStorage.getItem(key);
    if (saved !== raw) throw new Error('Cleaner-Journal wurde nicht bestätigt gespeichert.');
  });
  journalChain = operation;
  return operation;
};
const entryKey = (id: string, index: number): string => `tag-cleaner-entry-v1:${id}:${index}`;
export const saveCleanerJournalEntry = (journal: CleanerJournal, index: number): Promise<void> => {
  if (currentJournalEpoch!==journal.id) return Promise.reject(new Error('Cleaner-Journalepoch wurde abgelöst.'));
  const entry = journal.entries[index];
  if (!validEntry(entry)) throw new Error('Cleaner-Journaleintrag ungültig.');
  return persistConfirmed(entryKey(journal.id,index), JSON.stringify({version:1,journalId:journal.id,index,entry}));
};
export const saveCleanerJournal = async (journal: CleanerJournal): Promise<void> => {
  const raw = JSON.stringify(journal);
  parseCleanerJournal(raw);
  await persistConfirmed(JOURNAL_KEY,raw);
  currentJournalEpoch=journal.id;
};
export const loadCleanerJournal = async (): Promise<CleanerJournal | undefined> => {
  const raw = await AsyncStorage.getItem(JOURNAL_KEY);
  if (raw === null) return undefined;
  const journal = parseCleanerJournal(raw);
  currentJournalEpoch=journal.id;
  for (let start=0;start<journal.entries.length;start+=100) {
    const keys=journal.entries.slice(start,start+100).map((_,offset)=>entryKey(journal.id,start+offset));
    const records=await AsyncStorage.multiGet(keys);
    if (records.length!==keys.length) throw new Error('Cleaner-Journalread unvollständig.');
    records.forEach(([key,record],offset)=>{
      if (key!==keys[offset]) throw new Error('Cleaner-Journalread falsch zugeordnet.');
      if (record===null) return;
      const value: unknown=JSON.parse(record);
      if (!object(value) || value.version!==1 || value.journalId!==journal.id || value.index!==start+offset) throw new Error('Cleaner-Journalepoch nicht bestätigt.');
      const entry=value.entry;
      const original=journal.entries[start+offset];
      if (!validEntry(entry) || entry.songId!==original.songId || entry.sourceKey!==original.sourceKey || entry.mode!==original.mode)
        throw new Error('Cleaner-Journalrecord nicht bestätigt.');
      journal.entries[start+offset]=entry;
    });
  }
  return { ...journal, entries: journal.entries.map(entry => entry.status === 'pending' || entry.status === 'planned'
    ? { ...entry, status: 'interrupted', error: 'Unterbrochener Lauf. Natives Recovery und Quellen erneut prüfen; keine automatische Wiederholung.' } : entry) };
};
