import AsyncStorage from '@react-native-async-storage/async-storage';
import { commitBackupRestore, hasBackupRestoreJournal, recoverBackupRestore } from '../backupTransaction';
import { storage } from '../storage';
import { blockPersistenceForMaintenance, releasePersistenceMaintenance } from '../persistenceMaintenance';

const prefix = '@musikplayer:';
const journalKey = prefix + 'backupRestoreJournalV1';
const originalSet = AsyncStorage.setItem as jest.Mock;
const originalRemove = AsyncStorage.removeItem as jest.Mock;
const setImplementation = originalSet.getMockImplementation()!;
const removeImplementation = originalRemove.getMockImplementation()!;
beforeEach(async () => {
  releasePersistenceMaintenance();
  originalSet.mockImplementation(setImplementation); originalRemove.mockImplementation(removeImplementation);
  await AsyncStorage.clear();
  await AsyncStorage.setItem(prefix + 'playlists', '["old"]');
  await AsyncStorage.setItem(prefix + 'favoriteSongIds', '["keep"]');
  await AsyncStorage.setItem(prefix + 'songs', '["audio-library-untouched"]');
  await AsyncStorage.setItem(prefix + 'currentSongId', '"active"');
  jest.clearAllMocks();
});
afterEach(() => releasePersistenceMaintenance());

test('only confirmed complete values succeed; audio library and current track are untouched', async () => {
  await commitBackupRestore({ playlists: ['old', 'new'], favoriteSongIds: ['keep', 'new'] });
  expect(await AsyncStorage.getItem(prefix + 'playlists')).toBe('["old","new"]');
  expect(await AsyncStorage.getItem(prefix + 'favoriteSongIds')).toBe('["keep","new"]');
  expect(await hasBackupRestoreJournal()).toBe(false);
  expect(await AsyncStorage.getItem(prefix + 'songs')).toBe('["audio-library-untouched"]');
  expect(await AsyncStorage.getItem(prefix + 'currentSongId')).toBe('"active"');
});
test('a partial write failure restores every previous value and clears the prepared journal', async () => {
  let fail = true;
  originalSet.mockImplementation(async (key, value) => {
    if (key === prefix + 'favoriteSongIds' && fail) { fail = false; throw new Error('disk full'); }
    await setImplementation(key, value);
  });
  await expect(commitBackupRestore({ playlists: ['new'], favoriteSongIds: ['new'] })).rejects.toThrow('disk full');
  expect(await AsyncStorage.getItem(prefix + 'playlists')).toBe('["old"]');
  expect(await AsyncStorage.getItem(prefix + 'favoriteSongIds')).toBe('["keep"]');
  expect(await hasBackupRestoreJournal()).toBe(false);
});
test('a failed rollback retains ownership for a later successful startup recovery', async () => {
  originalSet.mockImplementation(async (key, value) => {
    if (key === prefix + 'favoriteSongIds' || (key === prefix + 'playlists' && value === '["old"]')) throw new Error('unavailable');
    await setImplementation(key, value);
  });
  await expect(commitBackupRestore({ playlists: ['new'], favoriteSongIds: ['new'] })).rejects.toThrow('unavailable');
  expect(await hasBackupRestoreJournal()).toBe(true);
  originalSet.mockImplementation(setImplementation);
  await expect(recoverBackupRestore()).resolves.toBe('rolled-back');
  expect(await AsyncStorage.getItem(prefix + 'playlists')).toBe('["old"]');
  expect(await hasBackupRestoreJournal()).toBe(false);
});
test.each(['prepared', 'committed'] as const)('startup after app-kill follows the durable %s phase', async phase => {
  const before = [{ key: 'playlists', raw: '["old"]' }, { key: 'favoriteSongIds', raw: null }];
  const after = [{ key: 'playlists', raw: '["new"]' }, { key: 'favoriteSongIds', raw: '["new"]' }];
  await AsyncStorage.setItem(journalKey, JSON.stringify({ version: 1, phase, before, after }));
  await AsyncStorage.setItem(prefix + 'playlists', '["halfway"]');
  await recoverBackupRestore();
  expect(await AsyncStorage.getItem(prefix + 'playlists')).toBe(phase === 'prepared' ? '["old"]' : '["new"]');
  expect(await AsyncStorage.getItem(prefix + 'favoriteSongIds')).toBe(phase === 'prepared' ? null : '["new"]');
  expect(await hasBackupRestoreJournal()).toBe(false);
});
test('a journal removal failure does not report success or allow a new restore to overlap', async () => {
  originalRemove.mockRejectedValue(new Error('journal retained'));
  await expect(commitBackupRestore({ favoriteSongIds: ['new'] })).rejects.toThrow('journal retained');
  expect(await hasBackupRestoreJournal()).toBe(true);
  await expect(commitBackupRestore({ favoriteSongIds: ['other'] })).rejects.toThrow('frühere');
  originalRemove.mockImplementation(removeImplementation);
  await expect(recoverBackupRestore()).resolves.toBe('completed');
  expect(await AsyncStorage.getItem(prefix + 'favoriteSongIds')).toBe('["new"]');
});
test('a marker write rejected after durable native completion recovers by commit phase', async () => {
  originalSet.mockImplementation(async (key, value) => {
    await setImplementation(key, value);
    if (key === journalKey && JSON.parse(value).phase === 'committed') throw new Error('late bridge rejection');
  });
  await expect(commitBackupRestore({ favoriteSongIds: ['new'] })).resolves.toBeUndefined();
  expect(await AsyncStorage.getItem(prefix + 'favoriteSongIds')).toBe('["new"]');
  expect(await hasBackupRestoreJournal()).toBe(false);
});
test('read-back mismatch fails and rolls back, including a write which resolves without storing', async () => {
  let skip = true;
  originalSet.mockImplementation(async (key, value) => {
    if (key === prefix + 'favoriteSongIds' && skip) { skip = false; return; }
    await setImplementation(key, value);
  });
  await expect(commitBackupRestore({ favoriteSongIds: ['new'] })).rejects.toThrow('nicht bestätigt');
  expect(await AsyncStorage.getItem(prefix + 'favoriteSongIds')).toBe('["keep"]');
});
test('corrupt or foreign-key journal keeps startup closed without writing any values', async () => {
  await AsyncStorage.setItem(journalKey, JSON.stringify({ version: 1, phase: 'prepared',
    before: [{ key: 'songs', raw: '[]' }], after: [{ key: 'songs', raw: '[]' }] }));
  originalSet.mockClear();
  await expect(recoverBackupRestore()).rejects.toThrow();
  expect(originalSet).not.toHaveBeenCalled();
});
test('normal restore-owned writes fail closed while the raw journal writer can complete', async () => {
  blockPersistenceForMaintenance();
  await expect(storage.set('favoriteSongIds', ['intruder'])).rejects.toThrow();
  await expect(commitBackupRestore({ favoriteSongIds: ['confirmed'] })).resolves.toBeUndefined();
  expect(await AsyncStorage.getItem(prefix + 'favoriteSongIds')).toBe('["confirmed"]');
});
test('another commit cannot overlap a hanging writer; startup recovery waits for its real settlement', async () => {
  let finish!: () => void;
  const delayed = new Promise<void>(resolve => { finish = resolve; });
  let started = false;
  originalSet.mockImplementation(async (key, value) => {
    if (key === prefix + 'favoriteSongIds' && value === '["new"]') { started = true; await delayed; }
    await setImplementation(key, value);
  });
  const first = commitBackupRestore({ favoriteSongIds: ['new'] });
  while (!started) await Promise.resolve();
  await expect(commitBackupRestore({ favoriteSongIds: ['overlap'] })).rejects.toThrow('schreibt noch');
  let recovered = false;
  const recovery = recoverBackupRestore().then(result => { recovered = true; return result; });
  await Promise.resolve();
  expect(recovered).toBe(false);
  finish(); await first;
  await expect(recovery).resolves.toBe('none');
  expect(await AsyncStorage.getItem(prefix + 'favoriteSongIds')).toBe('["new"]');
});
