const mockReadAsStringAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();
const mockCopyAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockGetInfoAsync = jest.fn();
let mockLegacyReadAsStringAsync: unknown;
let mockLegacyWriteAsStringAsync: unknown;
let mockLegacyCopyAsync: unknown;
let mockLegacyDeleteAsync: unknown;
let mockLegacyGetInfoAsync: unknown;

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  get readAsStringAsync() {
    return mockLegacyReadAsStringAsync;
  },
  get writeAsStringAsync() {
    return mockLegacyWriteAsStringAsync;
  },
  get copyAsync() {
    return mockLegacyCopyAsync;
  },
  get deleteAsync() {
    return mockLegacyDeleteAsync;
  },
  get getInfoAsync() {
    return mockLegacyGetInfoAsync;
  },
}));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

import {
  expoTagFileWriteAdapter,
  getDefaultReplaceSupportForPlatform,
  TagFileWriteAdapterError,
} from '../tagFileWriteAdapter';
import * as Base64Helpers from '../base64';

describe('expoTagFileWriteAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockLegacyReadAsStringAsync = (...args: unknown[]) => mockReadAsStringAsync(...args);
    mockLegacyWriteAsStringAsync = (...args: unknown[]) => mockWriteAsStringAsync(...args);
    mockLegacyCopyAsync = (...args: unknown[]) => mockCopyAsync(...args);
    mockLegacyDeleteAsync = (...args: unknown[]) => mockDeleteAsync(...args);
    mockLegacyGetInfoAsync = (...args: unknown[]) => mockGetInfoAsync(...args);
    mockReadAsStringAsync.mockResolvedValue('AQIDBA==');
    mockWriteAsStringAsync.mockResolvedValue(undefined);
    mockCopyAsync.mockResolvedValue(undefined);
    mockDeleteAsync.mockResolvedValue(undefined);
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 4, isDirectory: false });
  });

  test('reads bytes through FileSystem base64 and central decoder', async () => {
    await expect(expoTagFileWriteAdapter.readBytes('file:///music/song.mp3')).resolves.toEqual(
      new Uint8Array([1, 2, 3, 4]),
    );
    expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///music/song.mp3', { encoding: 'base64' });
  });

  test('writes bytes through central encoder and FileSystem base64', async () => {
    await expoTagFileWriteAdapter.writeBytes('file:///tmp/song.tmp', new Uint8Array([1, 2, 3, 4]));
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith('file:///tmp/song.tmp', 'AQIDBA==', { encoding: 'base64' });
  });

  test('copies files without reading bytes through JS', async () => {
    await expoTagFileWriteAdapter.copyFile('file:///music/song.mp3', 'file:///music/song.mp3.bak');
    expect(mockCopyAsync).toHaveBeenCalledWith({ from: 'file:///music/song.mp3', to: 'file:///music/song.mp3.bak' });
    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
  });

  test('replaces by copying replacement over target and leaves temp cleanup to caller', async () => {
    await expoTagFileWriteAdapter.moveOrReplaceFile('file:///tmp/song.tmp', 'file:///music/song.mp3');

    expect(mockCopyAsync).toHaveBeenCalledTimes(1);
    expect(mockCopyAsync).toHaveBeenCalledWith({ from: 'file:///tmp/song.tmp', to: 'file:///music/song.mp3' });
    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
    expect(mockDeleteAsync).not.toHaveBeenCalled();
  });

  test('deletes files idempotently', async () => {
    await expoTagFileWriteAdapter.deleteFile('file:///tmp/song.tmp');
    expect(mockDeleteAsync).toHaveBeenCalledWith('file:///tmp/song.tmp', { idempotent: true });
  });

  test('reads file info in a normalized shape', async () => {
    await expect(expoTagFileWriteAdapter.getInfo('file:///music/song.mp3')).resolves.toEqual({
      exists: true,
      size: 4,
      isDirectory: false,
    });
    expect(mockGetInfoAsync).toHaveBeenCalledWith('file:///music/song.mp3');
  });

  test('wraps failing FileSystem functions in controlled adapter errors', async () => {
    mockCopyAsync.mockRejectedValueOnce(new Error('copy rejected'));
    await expect(expoTagFileWriteAdapter.copyFile('file:///a', 'file:///b')).rejects.toMatchObject({
      name: 'TagFileWriteAdapterError',
      operation: 'copyFile',
    });
  });

  test('wraps malformed file info in controlled adapter errors', async () => {
    mockGetInfoAsync.mockResolvedValueOnce(undefined);
    await expect(expoTagFileWriteAdapter.getInfo('file:///missing')).rejects.toBeInstanceOf(TagFileWriteAdapterError);
  });

  test('large copy/replace operations do not use base64 JS read/write paths', async () => {
    await expoTagFileWriteAdapter.copyFile('file:///large.mp3', 'file:///large.mp3.bak');
    await expoTagFileWriteAdapter.moveOrReplaceFile('file:///large.mp3.tmp', 'file:///large.mp3');
    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
  });

  test('default replace support is android-only', () => {
    expect(getDefaultReplaceSupportForPlatform('android')).toBe(true);
    expect(getDefaultReplaceSupportForPlatform('ios')).toBe(false);
    expect(getDefaultReplaceSupportForPlatform('web')).toBe(false);
  });

  test('expo adapter exposes replace capability from platform helper', () => {
    expect(expoTagFileWriteAdapter.canReplaceExistingFile?.()).toBe(true);
  });

  test('missing FileSystem function produces a controlled adapter error', async () => {
    mockLegacyReadAsStringAsync = undefined;

    await expect(expoTagFileWriteAdapter.readBytes('file:///missing-api.mp3')).rejects.toMatchObject({
      name: 'TagFileWriteAdapterError',
      operation: 'readBytes',
      message: 'FileSystem function readAsStringAsync is unavailable.',
    });
  });

  test('base64 conversion is delegated to the central helpers', async () => {
    const decodeBase64ToBytes = jest
      .spyOn(Base64Helpers, 'decodeBase64ToBytes')
      .mockReturnValue(new Uint8Array([9, 8, 7]));
    const encodeBytesToBase64 = jest
      .spyOn(Base64Helpers, 'encodeBytesToBase64')
      .mockReturnValue('encoded-for-fs');
    mockReadAsStringAsync.mockResolvedValueOnce('encoded-from-fs');

    await expect(expoTagFileWriteAdapter.readBytes('file:///read.mp3')).resolves.toEqual(new Uint8Array([9, 8, 7]));
    expect(decodeBase64ToBytes).toHaveBeenCalledWith('encoded-from-fs');

    const bytes = new Uint8Array([1, 2, 3]);
    await expoTagFileWriteAdapter.writeBytes('file:///write.mp3', bytes);
    expect(encodeBytesToBase64).toHaveBeenCalledWith(bytes);
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith('file:///write.mp3', 'encoded-for-fs', { encoding: 'base64' });
  });

});
