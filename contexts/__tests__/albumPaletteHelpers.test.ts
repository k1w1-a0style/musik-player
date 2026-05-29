import SystemAudio from 'expo-system-audio';
import {
  extractAlbumPalette,
  getAlbumPaletteArtworkUri,
} from '../albumPaletteHelpers';
import type { Song } from '../../types/Song';

const songWithCover: Song = {
  id: 's1',
  title: 'One',
  artist: 'A',
  cover: 'file:///cover.jpg',
};

describe('albumPaletteHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('gets artwork uri from song', () => {
    expect(getAlbumPaletteArtworkUri(songWithCover)).toBe('file:///cover.jpg');
    expect(getAlbumPaletteArtworkUri(null)).toBeUndefined();
  });

  test('extracts album palette when artwork exists', async () => {
    jest.spyOn(SystemAudio, 'extractPalette').mockResolvedValueOnce({ dominant: '#111111' });

    await expect(extractAlbumPalette('file:///cover.jpg')).resolves.toEqual({ dominant: '#111111' });
    expect(SystemAudio.extractPalette).toHaveBeenCalledWith('file:///cover.jpg');
  });

  test('returns null without artwork or when extraction fails', async () => {
    await expect(extractAlbumPalette(undefined)).resolves.toBeNull();
    expect(SystemAudio.extractPalette).not.toHaveBeenCalled();

    jest.spyOn(SystemAudio, 'extractPalette').mockRejectedValueOnce(new Error('failed'));
    await expect(extractAlbumPalette('file:///cover.jpg')).resolves.toBeNull();
  });
});
