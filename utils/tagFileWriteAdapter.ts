import { copyAsync, deleteAsync, EncodingType, getInfoAsync, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export interface TagFileWriteAdapter {
  canReplaceExistingFile?: () => Promise<boolean> | boolean;
  readBytes(uri: string): Promise<Uint8Array>;
  writeBytes(uri: string, bytes: Uint8Array): Promise<void>;
  copyFile(fromUri: string, toUri: string): Promise<void>;
  moveOrReplaceFile(fromUri: string, toUri: string): Promise<void>;
  deleteFile(uri: string): Promise<void>;
  getInfo(uri: string): Promise<{ exists: boolean; size?: number; isDirectory?: boolean }>;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const encodeBytesBase64 = (bytes: Uint8Array): string => {
  if (typeof btoa === 'function') {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += BASE64_ALPHABET[(triple >> 18) & 0x3f];
    out += BASE64_ALPHABET[(triple >> 12) & 0x3f];
    out += i + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 0x3f] : '=';
    out += i + 2 < bytes.length ? BASE64_ALPHABET[triple & 0x3f] : '=';
  }
  return out;
};

export const getDefaultReplaceSupportForPlatform = (platform: string): boolean => platform === 'android';

const decodeBase64Bytes = (value: string): Uint8Array => {
  if (typeof atob === 'function') {
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i) & 0xff;
    return out;
  }

  const normalized = value.replace(/\s+/g, '');
  if (normalized.length % 4 !== 0) throw new Error('Invalid base64 length.');
  const map = new Map(BASE64_ALPHABET.split('').map((char, idx) => [char, idx] as const));
  const bytes: number[] = [];
  for (let i = 0; i < normalized.length; i += 4) {
    const chunk = normalized.slice(i, i + 4);
    const c0 = map.get(chunk[0]);
    const c1 = map.get(chunk[1]);
    const c2 = chunk[2] === '=' ? 0 : map.get(chunk[2]);
    const c3 = chunk[3] === '=' ? 0 : map.get(chunk[3]);
    if (c0 === undefined || c1 === undefined || c2 === undefined || c3 === undefined) throw new Error('Invalid base64 character.');
    const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    bytes.push((triple >> 16) & 0xff);
    if (chunk[2] !== '=') bytes.push((triple >> 8) & 0xff);
    if (chunk[3] !== '=') bytes.push(triple & 0xff);
  }
  return new Uint8Array(bytes);
};

export const expoTagFileWriteAdapter: TagFileWriteAdapter = {
  canReplaceExistingFile: () => getDefaultReplaceSupportForPlatform(Platform.OS),
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
    const bytes = await expoTagFileWriteAdapter.readBytes(fromUri);
    await expoTagFileWriteAdapter.writeBytes(toUri, bytes);
    await expoTagFileWriteAdapter.deleteFile(fromUri);
  },
  async deleteFile(uri) {
    await deleteAsync(uri, { idempotent: true });
  },
  async getInfo(uri) {
    const info = await getInfoAsync(uri);
    return { exists: info.exists, size: 'size' in info ? info.size : undefined, isDirectory: info.isDirectory };
  },
};
