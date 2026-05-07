import * as FileSystem from 'expo-file-system';
import { cacheBase64Cover, isBase64ImageDataUri, sanitizeSongsForStorage } from '../coverCache';
import type { Song } from '../../types/Song';

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
}));

describe('coverCache', () => {
  test('detects image base64 data uri', () => {
    expect(isBase64ImageDataUri('data:image/png;base64,AAA=')).toBe(true);
    expect(isBase64ImageDataUri('file:///cache/covers/a.png')).toBe(false);
    expect(isBase64ImageDataUri(undefined)).toBe(false);
  });

  test('migrates base64 covers to local file URIs', async () => {
    const songs: Song[] = [
      { id: '1', title: 'A', artist: 'X', cover: 'data:image/jpeg;base64,Zm9v' },
      { id: '2', title: 'B', artist: 'Y', cover: 'file:///cache/covers/2.jpg' },
    ];

    const result = await sanitizeSongsForStorage(songs);
    expect(result[0].cover).toBe('file:///docs/covers/1.jpg');
    expect(result[1].cover).toBe('file:///cache/covers/2.jpg');
    expect(result[0].cover?.startsWith('data:image/')).toBe(false);

    expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith('file:///docs/covers', {
      intermediates: true,
    });
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
  });

  test('cacheBase64Cover returns existing non-base64 URIs unchanged', async () => {
    await expect(cacheBase64Cover('x', 'file:///my.jpg')).resolves.toBe('file:///my.jpg');
  });

  test('preserves original base64 cover when file write fails', async () => {
    (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    const originalCover = 'data:image/png;base64,AAAA';
    const songs: Song[] = [{ id: 'fail-1', title: 'A', artist: 'B', cover: originalCover }];

    const result = await sanitizeSongsForStorage(songs);

    expect(result[0].cover).toBe(originalCover);
    expect(result[0].cover).not.toBeUndefined();
  });
});
