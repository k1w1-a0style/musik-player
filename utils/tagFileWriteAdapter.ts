import { copyAsync, deleteAsync, EncodingType, getInfoAsync, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { decodeBase64ToBytes, encodeBytesToBase64 } from './base64';

export interface TagFileWriteAdapter {
  canReplaceExistingFile?: () => Promise<boolean> | boolean;
  readBytes(uri: string): Promise<Uint8Array>;
  writeBytes(uri: string, bytes: Uint8Array): Promise<void>;
  copyFile(fromUri: string, toUri: string): Promise<void>;
  moveOrReplaceFile(fromUri: string, toUri: string): Promise<void>;
  deleteFile(uri: string): Promise<void>;
  getInfo(uri: string): Promise<{ exists: boolean; size?: number; isDirectory?: boolean }>;
}

export const getDefaultReplaceSupportForPlatform = (platform: string): boolean => platform === 'android';

export const expoTagFileWriteAdapter: TagFileWriteAdapter = {
  canReplaceExistingFile: () => getDefaultReplaceSupportForPlatform(Platform.OS),
  async readBytes(uri) {
    const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
    return decodeBase64ToBytes(base64);
  },
  async writeBytes(uri, bytes) {
    await writeAsStringAsync(uri, encodeBytesToBase64(bytes), { encoding: EncodingType.Base64 });
  },
  async copyFile(fromUri, toUri) {
    await copyAsync({ from: fromUri, to: toUri });
  },
  async moveOrReplaceFile(fromUri, toUri) {
    await copyAsync({ from: fromUri, to: toUri });
    await deleteAsync(fromUri, { idempotent: true });
  },
  async deleteFile(uri) {
    await deleteAsync(uri, { idempotent: true });
  },
  async getInfo(uri) {
    const info = await getInfoAsync(uri);
    return { exists: info.exists, size: 'size' in info ? info.size : undefined, isDirectory: info.isDirectory };
  },
};
