import { copyAsync, deleteAsync, EncodingType, getInfoAsync, moveAsync, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';

export interface TagFileWriteAdapter {
  readBytes(uri: string): Promise<Uint8Array>;
  writeBytes(uri: string, bytes: Uint8Array): Promise<void>;
  copyFile(fromUri: string, toUri: string): Promise<void>;
  moveOrReplaceFile(fromUri: string, toUri: string): Promise<void>;
  deleteFile(uri: string): Promise<void>;
  getInfo(uri: string): Promise<{ exists: boolean; size?: number; isDirectory?: boolean }>;
}

const encodeBytesBase64 = (bytes: Uint8Array): string => {
  if (typeof btoa === 'function') {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
};

const decodeBase64Bytes = (value: string): Uint8Array => {
  if (typeof atob === 'function') {
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i) & 0xff;
    return out;
  }
  return new Uint8Array(Buffer.from(value, 'base64'));
};

export const expoTagFileWriteAdapter: TagFileWriteAdapter = {
  async readBytes(uri) {
    const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
    return decodeBase64Bytes(base64);
  },
  async writeBytes(uri, bytes) {
    await writeAsStringAsync(uri, encodeBytesBase64(bytes), { encoding: EncodingType.Base64 });
  },
  async copyFile(fromUri, toUri) {
    await copyAsync({ from: fromUri, to: toUri });
  },
  async moveOrReplaceFile(fromUri, toUri) {
    try {
      await moveAsync({ from: fromUri, to: toUri });
      return;
    } catch {
      const bytes = await expoTagFileWriteAdapter.readBytes(fromUri);
      await expoTagFileWriteAdapter.writeBytes(toUri, bytes);
      await deleteAsync(fromUri, { idempotent: true });
    }
  },
  async deleteFile(uri) {
    await deleteAsync(uri, { idempotent: true });
  },
  async getInfo(uri) {
    const info = await getInfoAsync(uri);
    return { exists: info.exists, size: 'size' in info ? info.size : undefined, isDirectory: info.isDirectory };
  },
};
