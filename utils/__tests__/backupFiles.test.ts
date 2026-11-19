import { StorageAccessFramework, EncodingType } from 'expo-file-system/legacy';
import { BACKUP_READ_CHUNK_BYTES, chooseBackupFolder, readBackupFile, writeBackupFile } from '../backupFiles';
import { MAX_BACKUP_CODE_UNITS, serializeMusicBackup, type MusicBackup } from '../backupFormat';

jest.mock('expo-file-system/legacy', () => ({ EncodingType: { UTF8: 'utf8', Base64: 'base64' }, StorageAccessFramework: {
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
  saf.readAsStringAsync.mockResolvedValue(Buffer.from(serializeMusicBackup(backup)).toString('base64'));
});
test('exports a tiny backup on a device without room for a 12 MiB native array', async () => {
  const raw = serializeMusicBackup(backup);
  saf.readAsStringAsync.mockImplementation(async (_uri, options) => {
    if ((options?.length ?? Infinity) > BACKUP_READ_CHUNK_BYTES) throw new Error('native heap exhausted');
    return options?.encoding === 'base64' ? Buffer.from(raw, 'utf8').toString('base64') : raw;
  });
  await expect(writeBackupFile(backup)).resolves.toBe('content://new-backup');
});
test('native SAF read is bounded by BOTH offset and byte length even when provider size is unknown', async () => {
  await expect(readBackupFile('content://opaque-document')).resolves.toMatchObject({ backup });
  expect(saf.readAsStringAsync).toHaveBeenCalledWith('content://opaque-document', {
    encoding: EncodingType.Base64, position: 0, length: BACKUP_READ_CHUNK_BYTES,
  });
});
test('preserves UTF-8 characters split between read blocks', async () => {
  const unicode = { ...backup, playlists: [{ id: 'old', name: '🎧 Köln', songIds: [], createdAt: 1, updatedAt: 1 }] };
  const json = serializeMusicBackup(unicode);
  const raw = ' '.repeat(BACKUP_READ_CHUNK_BYTES - 2 - json.indexOf('🎧')) + json;
  const content = Buffer.from(raw, 'utf8');
  saf.readAsStringAsync.mockImplementation(async (_uri, options) => {
    const { position = 0, length = 0 } = options ?? {};
    return content.subarray(position, position + length).toString('base64');
  });
  await expect(readBackupFile('content://old-backup')).resolves.toEqual({ backup: unicode, raw });
  expect(saf.readAsStringAsync).toHaveBeenNthCalledWith(2, 'content://old-backup', {
    encoding: EncodingType.Base64, position: BACKUP_READ_CHUNK_BYTES, length: BACKUP_READ_CHUNK_BYTES,
  });
});
test('keeps the overall three-byte UTF-8 budget even if the SAF provider never reaches EOF', async () => {
  const block = Buffer.alloc(BACKUP_READ_CHUNK_BYTES, 0x20).toString('base64');
  saf.readAsStringAsync.mockImplementation(async (_uri, options) => options?.length === 1 ? 'IA==' : block);
  await expect(readBackupFile('content://oversize')).rejects.toThrow('Größenlimit');
  expect(saf.readAsStringAsync).toHaveBeenLastCalledWith('content://oversize', {
    encoding: EncodingType.Base64, position: MAX_BACKUP_CODE_UNITS * 3, length: 1,
  });
});
test('export only succeeds after exact read-back; creates a fresh file rather than overwriting', async () => {
  await expect(writeBackupFile(backup)).resolves.toBe('content://new-backup');
  expect(saf.createFileAsync).toHaveBeenCalledWith('content://backup-folder', expect.stringMatching(/^k1w1-Musik-Backup-/), 'application/json');
  expect(saf.writeAsStringAsync).toHaveBeenCalledWith('content://new-backup', serializeMusicBackup(backup), { encoding: EncodingType.UTF8 });
  expect(saf.deleteAsync).not.toHaveBeenCalled();
});
test.each(['truncated', 'mismatched'] as const)('rejects a %s export and cleans only its newly created file', async mode => {
  saf.readAsStringAsync.mockResolvedValue(Buffer.from(mode === 'truncated' ? '{' : serializeMusicBackup({ ...backup, createdAt: 2 })).toString('base64'));
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
