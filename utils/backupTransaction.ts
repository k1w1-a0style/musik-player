import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { BACKUP_SETTING_KEYS } from './backupFormat';

const PREFIX = '@musikplayer:';
const JOURNAL_KEY = `${PREFIX}backupRestoreJournalV1`;
const MAX_JOURNAL_CODE_UNITS = 16 * 1024 * 1024;
export const BACKUP_RESTORE_KEYS: ReadonlySet<string> = new Set([
  'playlists', 'favoriteSongIds', 'legacySongFavoritesMigrationCompleted', ...BACKUP_SETTING_KEYS,
]);
const entrySchema = z.object({ key: z.string().refine(key => BACKUP_RESTORE_KEYS.has(key)),
  raw: z.string().max(8 * 1024 * 1024).nullable() }).strict();
const journalSchema = z.object({ version: z.literal(1), phase: z.enum(['prepared', 'committed']),
  before: z.array(entrySchema).max(BACKUP_RESTORE_KEYS.size),
  after: z.array(entrySchema).max(BACKUP_RESTORE_KEYS.size),
}).strict();
type Journal = z.infer<typeof journalSchema>;
const readJournal = async (): Promise<Journal | null> => {
  const raw = await AsyncStorage.getItem(JOURNAL_KEY);
  if (raw === null) return null;
  if (raw.length > MAX_JOURNAL_CODE_UNITS) throw new Error('Wiederherstellungsjournal überschreitet das Größenlimit.');
  const journal = journalSchema.parse(JSON.parse(raw));
  const before = new Set(journal.before.map(entry => entry.key));
  const after = new Set(journal.after.map(entry => entry.key));
  if (before.size !== journal.before.length || after.size !== journal.after.length
    || before.size !== after.size || [...before].some(key => !after.has(key))) {
    throw new Error('Wiederherstellungsjournal enthält ungültige Verknüpfungen.');
  }
  return journal;
};
const serializeJournal = (journal: Journal): string => {
  const raw = JSON.stringify(journal);
  if (raw.length > MAX_JOURNAL_CODE_UNITS) throw new Error('Wiederherstellung überschreitet das sichere Größenlimit.');
  return raw;
};
const writeJournal = async (journal: Journal): Promise<void> => {
  const raw = serializeJournal(journal);
  await AsyncStorage.setItem(JOURNAL_KEY, raw);
  if (await AsyncStorage.getItem(JOURNAL_KEY) !== raw) throw new Error('Wiederherstellungsjournal wurde nicht bestätigt.');
};
const writeEntries = async (entries: Journal['before']): Promise<void> => {
  for (const entry of entries) {
    const key = PREFIX + entry.key;
    if (entry.raw === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, entry.raw);
    if (await AsyncStorage.getItem(key) !== entry.raw) throw new Error(`Speicherung von ${entry.key} wurde nicht bestätigt.`);
  }
};
const clearJournal = async (): Promise<void> => {
  await AsyncStorage.removeItem(JOURNAL_KEY);
  if (await AsyncStorage.getItem(JOURNAL_KEY) !== null) throw new Error('Wiederherstellung wartet auf Journalabschluss.');
};
/** Called with providers suspended, before any normal preference/library hydration. */
const performBackupRecovery = async (): Promise<'none' | 'rolled-back' | 'completed'> => {
  const journal = await readJournal();
  if (journal === null) return 'none';
  await writeEntries(journal.phase === 'prepared' ? journal.before : journal.after);
  await clearJournal();
  return journal.phase === 'prepared' ? 'rolled-back' : 'completed';
};
export const hasBackupRestoreJournal = async (): Promise<boolean> => (await AsyncStorage.getItem(JOURNAL_KEY)) !== null;

let activeBackupWork: Promise<unknown> | null = null;
const ownBackupWork = <T,>(work: Promise<T>): Promise<T> => {
  activeBackupWork = work;
  void work.then(() => { if (activeBackupWork === work) activeBackupWork = null; },
    () => { if (activeBackupWork === work) activeBackupWork = null; });
  return work;
};
export const recoverBackupRestore = (): Promise<'none' | 'rolled-back' | 'completed'> =>
  ownBackupWork((activeBackupWork ?? Promise.resolve()).catch(() => undefined).then(performBackupRecovery));

/** Owns all writes through read-back confirmation; the caller owns the maintenance fence. */
const performBackupCommit = async (values: Record<string, unknown>): Promise<void> => {
  if (await hasBackupRestoreJournal()) throw new Error('Eine frühere Wiederherstellung muss zuerst abgeschlossen werden.');
  const after = Object.entries(values).map(([key, value]) => ({ key, raw: JSON.stringify(value) }));
  if (after.some(entry => !BACKUP_RESTORE_KEYS.has(entry.key) || typeof entry.raw !== 'string')) {
    throw new Error('Nicht zulässiger Backup-Schlüssel.');
  }
  const before = [];
  for (const entry of after) before.push({ key: entry.key, raw: await AsyncStorage.getItem(PREFIX + entry.key) });
  const journal = journalSchema.parse({ version: 1, phase: 'prepared', before, after });
  serializeJournal(journal);
  let committed = false;
  try {
    await writeJournal(journal);
    await writeEntries(journal.after);
    await writeJournal({ ...journal, phase: 'committed' });
    committed = true;
    await clearJournal();
  } catch (error) {
    // If the commit-marker write itself failed after reaching native storage,
    // recovery reads the durable phase instead of guessing rollback.
    const durable = await readJournal();
    if (durable) await performBackupRecovery();
    else if (!committed) await writeEntries(before);
    if (committed || durable?.phase === 'committed') return;
    throw error;
  }
};
export const commitBackupRestore = (values: Record<string, unknown>): Promise<void> => {
  if (activeBackupWork) return Promise.reject(new Error('Eine Wiederherstellung schreibt noch. Bitte warte auf ihren Abschluss.'));
  return ownBackupWork(Promise.resolve().then(() => performBackupCommit(values)));
};
