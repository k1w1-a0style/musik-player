import * as LegacyFileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import * as Base64Helpers from './base64';

export interface TagFileWriteAdapter {
  canReplaceExistingFile?: () => Promise<boolean> | boolean;
  readBytes(uri: string): Promise<Uint8Array>;
  writeBytes(uri: string, bytes: Uint8Array): Promise<void>;
  copyFile(fromUri: string, toUri: string): Promise<void>;
  moveOrReplaceFile(fromUri: string, toUri: string): Promise<void>;
  deleteFile(uri: string): Promise<void>;
  getInfo(uri: string): Promise<{ exists: boolean; size?: number; isDirectory?: boolean }>;
}

export type TagFileWriteOperation =
  | 'readBytes'
  | 'writeBytes'
  | 'copyFile'
  | 'moveOrReplaceFile'
  | 'deleteFile'
  | 'getInfo';

export class TagFileWriteAdapterError extends Error {
  constructor(
    readonly operation: TagFileWriteOperation,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'TagFileWriteAdapterError';
  }
}

// Tag writes need the legacy FileSystem module for now because Expo's modern File API
// does not provide an async, consistently overwrite-safe copy/delete/getInfo surface for
// URI-backed media files across platforms. The risk is relying on deprecated APIs, so this
// adapter is the single boundary; migrate once modern async file replacement and range-safe
// info semantics are available for the target Expo SDK/platforms.

type LegacyFileSystemFunction<T extends (...args: never[]) => Promise<unknown>> = T | undefined;

const missingFunctionError = (operation: TagFileWriteOperation, functionName: string): TagFileWriteAdapterError =>
  new TagFileWriteAdapterError(operation, `FileSystem function ${functionName} is unavailable.`);

const wrapFileSystemError = (
  operation: TagFileWriteOperation,
  message: string,
  error: unknown,
): TagFileWriteAdapterError =>
  error instanceof TagFileWriteAdapterError
    ? error
    : new TagFileWriteAdapterError(operation, message, error);

const requireFileSystemFunction = <T extends (...args: never[]) => Promise<unknown>>(
  operation: TagFileWriteOperation,
  functionName: string,
  fn: LegacyFileSystemFunction<T>,
): T => {
  if (typeof fn !== 'function') throw missingFunctionError(operation, functionName);
  return fn;
};

const base64Encoding = (): 'base64' => (LegacyFileSystem.EncodingType.Base64 ?? 'base64') as 'base64';

export const getDefaultReplaceSupportForPlatform = (platform: string): boolean => platform === 'android';

export const expoTagFileWriteAdapter: TagFileWriteAdapter = {
  canReplaceExistingFile: () => getDefaultReplaceSupportForPlatform(Platform.OS),
  async readBytes(uri) {
    try {
      const read = requireFileSystemFunction('readBytes', 'readAsStringAsync', LegacyFileSystem.readAsStringAsync);
      const base64 = await read(uri, { encoding: base64Encoding() });
      return Base64Helpers.decodeBase64ToBytes(String(base64));
    } catch (error) {
      throw wrapFileSystemError('readBytes', `Failed to read bytes from ${uri}.`, error);
    }
  },
  async writeBytes(uri, bytes) {
    try {
      const write = requireFileSystemFunction('writeBytes', 'writeAsStringAsync', LegacyFileSystem.writeAsStringAsync);
      await write(uri, Base64Helpers.encodeBytesToBase64(bytes), { encoding: base64Encoding() });
    } catch (error) {
      throw wrapFileSystemError('writeBytes', `Failed to write bytes to ${uri}.`, error);
    }
  },
  async copyFile(fromUri, toUri) {
    try {
      const copy = requireFileSystemFunction('copyFile', 'copyAsync', LegacyFileSystem.copyAsync);
      await copy({ from: fromUri, to: toUri });
    } catch (error) {
      throw wrapFileSystemError('copyFile', `Failed to copy ${fromUri} to ${toUri}.`, error);
    }
  },
  async moveOrReplaceFile(fromUri, toUri) {
    try {
      const copy = requireFileSystemFunction('moveOrReplaceFile', 'copyAsync', LegacyFileSystem.copyAsync);
      await copy({ from: fromUri, to: toUri });
    } catch (error) {
      throw wrapFileSystemError('moveOrReplaceFile', `Failed to replace ${toUri} with ${fromUri}.`, error);
    }
  },
  async deleteFile(uri) {
    try {
      const erase = requireFileSystemFunction('deleteFile', 'deleteAsync', LegacyFileSystem.deleteAsync);
      await erase(uri, { idempotent: true });
    } catch (error) {
      throw wrapFileSystemError('deleteFile', `Failed to delete ${uri}.`, error);
    }
  },
  async getInfo(uri) {
    try {
      const infoForUri = requireFileSystemFunction('getInfo', 'getInfoAsync', LegacyFileSystem.getInfoAsync);
      const info = await infoForUri(uri);
      if (!info || typeof info !== 'object' || !('exists' in info)) {
        throw new TagFileWriteAdapterError('getInfo', `FileSystem info for ${uri} was malformed.`);
      }
      return {
        exists: Boolean(info.exists),
        size: 'size' in info && typeof info.size === 'number' ? info.size : undefined,
        isDirectory: 'isDirectory' in info && typeof info.isDirectory === 'boolean' ? info.isDirectory : undefined,
      };
    } catch (error) {
      throw wrapFileSystemError('getInfo', `Failed to read file info for ${uri}.`, error);
    }
  },
};
