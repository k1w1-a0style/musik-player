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

  test('writes replacement bytes without deleting destination first, then removes source temp file', async () => {
    mockReadAsStringAsync.mockResolvedValue('AQID'); // [1,2,3]

    await expoTagFileWriteAdapter.moveOrReplaceFile('file:///tmp/song.tmp', 'file:///music/song.mp3');

    expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///tmp/song.tmp', { encoding: 'base64' });
    expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith('file:///music/song.mp3', 'AQID', { encoding: 'base64' });
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
