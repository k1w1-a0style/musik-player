import SystemAudio from 'expo-system-audio';
import {
  ALBUM_PALETTE_EXTRACTION_TIMEOUT_MS,
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
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
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

  test('returns null when artwork is missing', async () => {
    await expect(extractAlbumPalette(undefined)).resolves.toBeNull();
    expect(SystemAudio.extractPalette).not.toHaveBeenCalled();
  });

  test('returns null when native palette extraction rejects', async () => {
    jest.spyOn(SystemAudio, 'extractPalette').mockRejectedValueOnce(new Error('failed'));

    await expect(extractAlbumPalette('file:///cover.jpg')).resolves.toBeNull();
  });

  test('returns null when native palette extraction times out', async () => {
    jest.useFakeTimers();
    // Intentionally unresolved to model a native call that never returns; withTimeout
    // releases the JS awaiter even though the native work itself may still be pending.
    jest.spyOn(SystemAudio, 'extractPalette').mockReturnValueOnce(new Promise(() => undefined));

    const result = extractAlbumPalette('file:///cover.jpg');
    jest.advanceTimersByTime(ALBUM_PALETTE_EXTRACTION_TIMEOUT_MS);

    await expect(result).resolves.toBeNull();
  });

  test('returns null when album palette extraction is externally aborted', async () => {
    jest.useFakeTimers();
    // Intentionally unresolved to model a native call that remains non-cancellable while
    // the JS awaiter/timer path is aborted by the caller.
    jest.spyOn(SystemAudio, 'extractPalette').mockReturnValueOnce(new Promise(() => undefined));
    const controller = new AbortController();

    const result = extractAlbumPalette('file:///cover.jpg', { signal: controller.signal });
    controller.abort();

    await expect(result).resolves.toBeNull();
    jest.clearAllTimers();
  });
});
