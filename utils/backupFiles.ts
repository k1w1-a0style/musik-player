import { StorageAccessFramework, EncodingType } from 'expo-file-system/legacy';
import { MAX_BACKUP_CODE_UNITS, parseMusicBackup, serializeMusicBackup, type MusicBackup } from './backupFormat';
import { decodeBase64ToBytes } from './base64';
import { concatBytes } from './tagWriterBytes';

const MAX_BACKUP_BYTES = MAX_BACKUP_CODE_UNITS * 3;
export const BACKUP_READ_CHUNK_BYTES = 256 * 1024;
const oversizedBackup = () => new Error('Backupdatei überschreitet das sichere Größenlimit.');

const readBackupBytes = async (uri: string): Promise<Uint8Array> => {
  const parts: Uint8Array[] = [];
  let position = 0;
  while (position <= MAX_BACKUP_BYTES) {
    // Expo allocates the whole requested range on the Android heap, even at
    // EOF. Read bounded byte blocks and decode UTF-8 only after reassembly.
    const length = Math.min(BACKUP_READ_CHUNK_BYTES, MAX_BACKUP_BYTES + 1 - position);
    const encoded = await StorageAccessFramework.readAsStringAsync(uri, {
      encoding: EncodingType.Base64, position, length,
    });
    if (encoded.length > Math.ceil(length / 3) * 4) throw oversizedBackup();
    if (!encoded) break;
    const bytes = decodeBase64ToBytes(encoded);
    position += bytes.length;
    if (bytes.length > length || position > MAX_BACKUP_BYTES) throw oversizedBackup();
    parts.push(bytes);
    if (bytes.length < length) break;
  }
  return parts.length === 1 ? parts[0] : concatBytes(parts);
};

export const readBackupFile = async (uri: string): Promise<{ backup: MusicBackup; raw: string }> => {
  const bytes = await readBackupBytes(uri);
  const raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  if (raw.length > MAX_BACKUP_CODE_UNITS) throw oversizedBackup();
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
