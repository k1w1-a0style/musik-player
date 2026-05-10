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

import { expoTagFileWriteAdapter } from '../tagFileWriteAdapter';

describe('expoTagFileWriteAdapter moveOrReplaceFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deletes existing destination before writing replacement bytes and removes source temp file', async () => {
    mockReadAsStringAsync.mockResolvedValue('AQID'); // [1,2,3]
    mockGetInfoAsync.mockResolvedValue({ exists: true, isDirectory: false, size: 3 });

    await expoTagFileWriteAdapter.moveOrReplaceFile('file:///tmp/song.tmp', 'file:///music/song.mp3');

    expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///tmp/song.tmp', { encoding: 'base64' });
    expect(mockGetInfoAsync).toHaveBeenCalledWith('file:///music/song.mp3');
    expect(mockDeleteAsync).toHaveBeenNthCalledWith(1, 'file:///music/song.mp3', { idempotent: true });
    expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith('file:///music/song.mp3', 'AQID', { encoding: 'base64' });
    expect(mockDeleteAsync).toHaveBeenNthCalledWith(2, 'file:///tmp/song.tmp', { idempotent: true });
  });
});
