import { copyAsync, deleteAsync, EncodingType, getInfoAsync, moveAsync, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';

export interface TagFileWriteAdapter {
  readBytes(uri: string): Promise<Uint8Array>;
  writeBytes(uri: string, bytes: Uint8Array): Promise<void>;
  copyFile(fromUri: string, toUri: string): Promise<void>;
  moveOrReplaceFile(fromUri: string, toUri: string): Promise<void>;
  deleteFile(uri: string): Promise<void>;
  getInfo(uri: string): Promise<{ exists: boolean; size?: number; isDirectory?: boolean }>;
}

const toBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');
const fromBase64 = (value: string): Uint8Array => new Uint8Array(Buffer.from(value, 'base64'));

export const expoTagFileWriteAdapter: TagFileWriteAdapter = {
  async readBytes(uri) {
    const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
    return fromBase64(base64);
  },
  async writeBytes(uri, bytes) {
    await writeAsStringAsync(uri, toBase64(bytes), { encoding: EncodingType.Base64 });
  },
  async copyFile(fromUri, toUri) {
    await copyAsync({ from: fromUri, to: toUri });
  },
  async moveOrReplaceFile(fromUri, toUri) {
    await deleteAsync(toUri, { idempotent: true });
    await moveAsync({ from: fromUri, to: toUri });
  },
  async deleteFile(uri) {
    await deleteAsync(uri, { idempotent: true });
  },
  async getInfo(uri) {
    const info = await getInfoAsync(uri);
    return { exists: info.exists, size: 'size' in info ? info.size : undefined, isDirectory: info.isDirectory };
  },
};
