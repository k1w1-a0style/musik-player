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

  test('queues the latest different palette while native work is active', async () => {
    let resolveFirst: (value: { dominant: string }) => void = () => undefined;
    jest
      .spyOn(SystemAudio, 'extractPalette')
      .mockReturnValueOnce(new Promise(resolve => {
        resolveFirst = resolve;
      }))
      .mockResolvedValueOnce({ dominant: '#333333' });

    const first = extractAlbumPalette('file:///first.jpg');
    const second = extractAlbumPalette('file:///second.jpg');
    await Promise.resolve();

    expect(SystemAudio.extractPalette).toHaveBeenCalledTimes(1);

    resolveFirst({ dominant: '#111111' });
    await expect(first).resolves.toEqual({ dominant: '#111111' });
    await expect(second).resolves.toEqual({ dominant: '#333333' });
    expect(SystemAudio.extractPalette).toHaveBeenCalledTimes(2);
  });

  test('drops an obsolete queued artwork and extracts only the newest request', async () => {
    let resolveFirst: (value: { dominant: string }) => void = () => undefined;
    jest
      .spyOn(SystemAudio, 'extractPalette')
      .mockReturnValueOnce(new Promise(resolve => {
        resolveFirst = resolve;
      }))
      .mockResolvedValueOnce({ dominant: '#444444' });

    const first = extractAlbumPalette('file:///first.jpg');
    const obsolete = extractAlbumPalette('file:///obsolete.jpg');
    const latest = extractAlbumPalette('file:///latest.jpg');

    await expect(obsolete).resolves.toBeNull();
    resolveFirst({ dominant: '#111111' });
    await expect(first).resolves.toEqual({ dominant: '#111111' });
    await expect(latest).resolves.toEqual({ dominant: '#444444' });
    expect(SystemAudio.extractPalette).toHaveBeenCalledTimes(2);
    expect(SystemAudio.extractPalette).toHaveBeenLastCalledWith('file:///latest.jpg');
  });

  test('cancels a queued artwork when the latest request returns to the active one', async () => {
    let resolveFirst: (value: { dominant: string }) => void = () => undefined;
    jest.spyOn(SystemAudio, 'extractPalette').mockReturnValueOnce(new Promise(resolve => {
      resolveFirst = resolve;
    }));

    const first = extractAlbumPalette('file:///first.jpg');
    const obsolete = extractAlbumPalette('file:///obsolete.jpg');
    const currentAgain = extractAlbumPalette('file:///first.jpg');

    await expect(obsolete).resolves.toBeNull();
    resolveFirst({ dominant: '#111111' });
    await expect(Promise.all([first, currentAgain])).resolves.toEqual([
      { dominant: '#111111' },
      { dominant: '#111111' },
    ]);
    expect(SystemAudio.extractPalette).toHaveBeenCalledTimes(1);
  });

  test('reuses a resolved palette from memory without another native extraction', async () => {
    jest.spyOn(SystemAudio, 'extractPalette').mockResolvedValueOnce({ dominant: '#555555' });

    await expect(extractAlbumPalette('file:///cached.jpg')).resolves.toEqual({ dominant: '#555555' });
    await expect(extractAlbumPalette('file:///cached.jpg')).resolves.toEqual({ dominant: '#555555' });

    expect(SystemAudio.extractPalette).toHaveBeenCalledTimes(1);
  });

  test('returns null when artwork is missing', async () => {
    await expect(extractAlbumPalette(undefined)).resolves.toBeNull();
    expect(SystemAudio.extractPalette).not.toHaveBeenCalled();
  });

  test('returns null when native palette extraction rejects', async () => {
    jest.spyOn(SystemAudio, 'extractPalette').mockRejectedValueOnce(new Error('failed'));

    await expect(extractAlbumPalette('file:///cover.jpg')).resolves.toBeNull();
  });

  test('releases a timed-out slot so the latest artwork can still resolve', async () => {
    jest.useFakeTimers();
    jest.spyOn(SystemAudio, 'extractPalette')
      .mockReturnValueOnce(new Promise(() => undefined))
      .mockResolvedValueOnce({ dominant: '#666666' });

    const result = extractAlbumPalette('file:///cover.jpg');
    const latest = extractAlbumPalette('file:///other.jpg');
    await jest.advanceTimersByTimeAsync(ALBUM_PALETTE_EXTRACTION_TIMEOUT_MS);

    await expect(result).resolves.toBeNull();
    await expect(latest).resolves.toEqual({ dominant: '#666666' });
    expect(SystemAudio.extractPalette).toHaveBeenCalledTimes(2);
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
