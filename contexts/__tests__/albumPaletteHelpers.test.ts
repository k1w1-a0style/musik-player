import SystemAudio from 'expo-system-audio';
import {
  ALBUM_PALETTE_EXTRACTION_TIMEOUT_MS,
  extractAlbumPalette,
  getAlbumPaletteArtworkUri,
  resetAlbumPaletteSingleFlightForTests,
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
    resetAlbumPaletteSingleFlightForTests();
  });

  afterEach(() => {
    jest.useRealTimers();
    resetAlbumPaletteSingleFlightForTests();
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

  test('coalesces concurrent requests for the same artwork', async () => {
    let resolvePalette: (value: { dominant: string }) => void = () => undefined;
    jest.spyOn(SystemAudio, 'extractPalette').mockReturnValueOnce(new Promise(resolve => {
      resolvePalette = resolve;
    }));

    const first = extractAlbumPalette('file:///shared.jpg');
    const second = extractAlbumPalette('file:///shared.jpg');
    await Promise.resolve();

    expect(SystemAudio.extractPalette).toHaveBeenCalledTimes(1);
    resolvePalette({ dominant: '#222222' });
    await expect(Promise.all([first, second])).resolves.toEqual([
      { dominant: '#222222' },
      { dominant: '#222222' },
    ]);
  });

  test('does not start a different palette while native work is still active', async () => {
    let resolveFirst: (value: { dominant: string }) => void = () => undefined;
    jest
      .spyOn(SystemAudio, 'extractPalette')
      .mockReturnValueOnce(new Promise(resolve => {
        resolveFirst = resolve;
      }))
      .mockResolvedValueOnce({ dominant: '#333333' });

    const first = extractAlbumPalette('file:///first.jpg');
    await Promise.resolve();

    await expect(extractAlbumPalette('file:///second.jpg')).resolves.toBeNull();
    expect(SystemAudio.extractPalette).toHaveBeenCalledTimes(1);

    resolveFirst({ dominant: '#111111' });
    await expect(first).resolves.toEqual({ dominant: '#111111' });
    await expect(extractAlbumPalette('file:///second.jpg')).resolves.toEqual({ dominant: '#333333' });
    expect(SystemAudio.extractPalette).toHaveBeenCalledTimes(2);
  });

  test('returns null when artwork is missing', async () => {
    await expect(extractAlbumPalette(undefined)).resolves.toBeNull();
    expect(SystemAudio.extractPalette).not.toHaveBeenCalled();
  });

  test('returns null when native palette extraction rejects', async () => {
    jest.spyOn(SystemAudio, 'extractPalette').mockRejectedValueOnce(new Error('failed'));

    await expect(extractAlbumPalette('file:///cover.jpg')).resolves.toBeNull();
  });

  test('returns null when native palette extraction times out and keeps the slot occupied', async () => {
    jest.useFakeTimers();
    // Intentionally unresolved to model a native call that never returns. The
    // caller times out, but single-flight ownership remains with the raw call.
    jest.spyOn(SystemAudio, 'extractPalette').mockReturnValueOnce(new Promise(() => undefined));

    const result = extractAlbumPalette('file:///cover.jpg');
    await jest.advanceTimersByTimeAsync(ALBUM_PALETTE_EXTRACTION_TIMEOUT_MS);

    await expect(result).resolves.toBeNull();
    await expect(extractAlbumPalette('file:///other.jpg')).resolves.toBeNull();
    expect(SystemAudio.extractPalette).toHaveBeenCalledTimes(1);
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
