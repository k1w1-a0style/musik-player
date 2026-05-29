const mockReadAsStringAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();
const mockCopyAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockGetInfoAsync = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
  copyAsync: (...args: unknown[]) => mockCopyAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
}));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

import { expoTagFileWriteAdapter, getDefaultReplaceSupportForPlatform } from '../tagFileWriteAdapter';

describe('expoTagFileWriteAdapter moveOrReplaceFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('copies replacement file without reading bytes through JS, then removes source temp file', async () => {
    await expoTagFileWriteAdapter.moveOrReplaceFile('file:///tmp/song.tmp', 'file:///music/song.mp3');

    expect(mockCopyAsync).toHaveBeenCalledTimes(1);
    expect(mockCopyAsync).toHaveBeenCalledWith({ from: 'file:///tmp/song.tmp', to: 'file:///music/song.mp3' });
    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
    expect(mockDeleteAsync).toHaveBeenCalledTimes(1);
    expect(mockDeleteAsync).toHaveBeenCalledWith('file:///tmp/song.tmp', { idempotent: true });
  });

  test('default replace support is android-only', () => {
    expect(getDefaultReplaceSupportForPlatform('android')).toBe(true);
    expect(getDefaultReplaceSupportForPlatform('ios')).toBe(false);
    expect(getDefaultReplaceSupportForPlatform('web')).toBe(false);
  });

  test('expo adapter exposes replace capability from platform helper', () => {
    expect(expoTagFileWriteAdapter.canReplaceExistingFile?.()).toBe(true);
  });
});
