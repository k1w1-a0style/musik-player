import { StorageAccessFramework, EncodingType } from 'expo-file-system/legacy';
import { MAX_BACKUP_CODE_UNITS, parseMusicBackup, serializeMusicBackup, type MusicBackup } from './backupFormat';

// The pinned native FileSystem reader honours length AND position for UTF-8
// and SAF streams. Both options are mandatory; provider size is not trusted.
const MAX_BACKUP_BYTES = MAX_BACKUP_CODE_UNITS * 3;
export const readBackupFile = async (uri: string): Promise<{ backup: MusicBackup; raw: string }> => {
  const raw = await StorageAccessFramework.readAsStringAsync(uri, {
    encoding: EncodingType.UTF8, position: 0, length: MAX_BACKUP_BYTES + 1,
  });
  if (raw.length > MAX_BACKUP_CODE_UNITS) throw new Error('Backupdatei überschreitet das sichere Größenlimit.');
  return { backup: parseMusicBackup(raw), raw };
};
export const chooseBackupFolder = async (): Promise<string[] | null> => {
  const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return null;
  const files = await StorageAccessFramework.readDirectoryAsync(permission.directoryUri);
  if (files.length > 1000) throw new Error('Dieser Ordner enthält zu viele Dateien. Bitte wähle einen kleineren Backup-Ordner.');
  return files;
};
export const writeBackupFile = async (backup: MusicBackup): Promise<string | null> => {
  const raw = serializeMusicBackup(backup);
  const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return null;
  const name = `k1w1-Musik-Backup-${new Date(backup.createdAt).toISOString().replace(/[:.]/g, '-')}`;
  const uri = await StorageAccessFramework.createFileAsync(permission.directoryUri, name, 'application/json');
  try {
    await StorageAccessFramework.writeAsStringAsync(uri, raw, { encoding: EncodingType.UTF8 });
    const confirmed = await readBackupFile(uri);
    if (confirmed.raw !== raw) throw new Error('Die exportierte Datei wurde nicht vollständig bestätigt.');
    return uri;
  } catch (error) {
    await StorageAccessFramework.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    throw error;
  }
};
export const backupFileLabel = (uri: string, index: number): string => {
  try {
    const tail = decodeURIComponent(uri.split('/').pop() ?? '').split('/').pop();
    return tail && /\.json$/i.test(tail) ? tail : `Datei ${index + 1}`;
  } catch { return `Datei ${index + 1}`; }
};
