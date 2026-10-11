import { StorageAccessFramework, EncodingType } from 'expo-file-system/legacy';
import { chooseBackupFolder, readBackupFile, writeBackupFile } from '../backupFiles';
import { MAX_BACKUP_CODE_UNITS, serializeMusicBackup, type MusicBackup } from '../backupFormat';

jest.mock('expo-file-system/legacy', () => ({ EncodingType: { UTF8: 'utf8' }, StorageAccessFramework: {
  requestDirectoryPermissionsAsync: jest.fn(), readDirectoryAsync: jest.fn(), readAsStringAsync: jest.fn(),
  createFileAsync: jest.fn(), writeAsStringAsync: jest.fn(), deleteAsync: jest.fn().mockResolvedValue(undefined),
} }));
const saf = StorageAccessFramework as jest.Mocked<typeof StorageAccessFramework>;
const backup: MusicBackup = { format: 'k1w1-musik-backup', version: 1, createdAt: 1700000000000,
  songs: [], favorites: [], playlists: [], settings: { appThemeSkin: 'minimal' } };
beforeEach(() => {
  jest.clearAllMocks();
  saf.requestDirectoryPermissionsAsync.mockResolvedValue({ granted: true, directoryUri: 'content://backup-folder' });
  saf.createFileAsync.mockResolvedValue('content://new-backup');
  saf.writeAsStringAsync.mockResolvedValue(undefined);
  saf.readAsStringAsync.mockResolvedValue(serializeMusicBackup(backup));
});
test('native SAF read is bounded by BOTH offset and byte length even when provider size is unknown', async () => {
  await expect(readBackupFile('content://opaque-document')).resolves.toMatchObject({ backup });
  expect(saf.readAsStringAsync).toHaveBeenCalledWith('content://opaque-document', {
    encoding: EncodingType.UTF8, position: 0, length: MAX_BACKUP_CODE_UNITS * 3 + 1,
  });
});
test('export only succeeds after exact read-back; creates a fresh file rather than overwriting', async () => {
  await expect(writeBackupFile(backup)).resolves.toBe('content://new-backup');
  expect(saf.createFileAsync).toHaveBeenCalledWith('content://backup-folder', expect.stringMatching(/^k1w1-Musik-Backup-/), 'application/json');
  expect(saf.writeAsStringAsync).toHaveBeenCalledWith('content://new-backup', serializeMusicBackup(backup), { encoding: EncodingType.UTF8 });
  expect(saf.deleteAsync).not.toHaveBeenCalled();
});
test.each(['truncated', 'mismatched'] as const)('rejects a %s export and cleans only its newly created file', async mode => {
  saf.readAsStringAsync.mockResolvedValue(mode === 'truncated' ? '{' : serializeMusicBackup({ ...backup, createdAt: 2 }));
  await expect(writeBackupFile(backup)).rejects.toThrow();
  expect(saf.deleteAsync).toHaveBeenCalledWith('content://new-backup', { idempotent: true });
});
test('full filesystem and revoked SAF permission never produce a success result', async () => {
  saf.writeAsStringAsync.mockRejectedValueOnce(new Error('disk full'));
  await expect(writeBackupFile(backup)).rejects.toThrow('disk full');
  saf.requestDirectoryPermissionsAsync.mockRejectedValueOnce(new Error('permission lost'));
  await expect(writeBackupFile(backup)).rejects.toThrow('permission lost');
});
test('cancelled directory chooser creates or reads no file', async () => {
  saf.requestDirectoryPermissionsAsync.mockResolvedValue({ granted: false });
  await expect(writeBackupFile(backup)).resolves.toBeNull();
  await expect(chooseBackupFolder()).resolves.toBeNull();
  expect(saf.createFileAsync).not.toHaveBeenCalled();
  expect(saf.readAsStringAsync).not.toHaveBeenCalled();
});
test('opaque provider IDs stay selectable, while oversized folders fail explicitly', async () => {
  saf.readDirectoryAsync.mockResolvedValueOnce(['content://provider/42']);
  await expect(chooseBackupFolder()).resolves.toEqual(['content://provider/42']);
  saf.readDirectoryAsync.mockResolvedValueOnce(Array(1001).fill('content://provider/42'));
  await expect(chooseBackupFolder()).rejects.toThrow('zu viele Dateien');
});
