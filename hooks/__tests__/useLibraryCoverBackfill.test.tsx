import { renderHook, waitFor } from '@testing-library/react-native';
import SystemAudio from 'expo-system-audio';
import { useLibraryCoverBackfill } from '../useLibraryCoverBackfill';
import { createCoverCacheProtection } from '../../utils/coverCacheCleanup';
import type { Song } from '../../types/Song';

jest.mock('expo-system-audio', () => ({
  extractEmbeddedArtwork: jest.fn(),
}));

jest.mock('../../utils/coverCache', () => ({
  cacheLocalCoverFile: jest.fn(async (_songId: string, uri?: string) => uri?.replace('file:///cache/', 'file:///docs/covers/')),
  isLikelyVolatileArtworkUri: jest.fn((uri?: string) => uri?.startsWith('file:///cache/') ?? false),
}));

const mockRelease = jest.fn();
const mockProtection = {
  protectUri: jest.fn(),
  protectSongCovers: jest.fn(),
  replaceProtectedSongCovers: jest.fn(),
  release: mockRelease,
};

jest.mock('../../utils/coverCacheCleanup', () => ({
  createCoverCacheProtection: jest.fn(() => mockProtection),
}));

const song = (id: string, patch: Partial<Song> = {}): Song => ({
  id,
  title: id,
  artist: 'Artist',
  uri: `file:///${id}.mp3`,
  ...patch,
});

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('useLibraryCoverBackfill', () => {
  beforeEach(() => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockReset();
    mockRelease.mockClear();
    mockProtection.protectUri.mockClear();
    mockProtection.protectSongCovers.mockClear();
    mockProtection.replaceProtectedSongCovers.mockClear();
    (createCoverCacheProtection as jest.Mock).mockClear();
  });

  test('requeues coverless songs after an aborted stale backfill round', async () => {
    const deferred: Array<{ resolve: (value: { uri: string }) => void }> = [];
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockImplementation(
      () => new Promise(resolve => deferred.push({ resolve })),
    );
    const setSongs = jest.fn();
    const applySongMetadataPatches = jest.fn();
    const songs = [song('a')];

    const { rerender } = renderHook(
      ({ value }: { value: Song[] }) => useLibraryCoverBackfill({ songs: value, setSongs, applySongMetadataPatches }),
      { initialProps: { value: songs } },
    );

    await waitFor(() => expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(1));
    rerender({ value: [song('a', { title: 'renamed' })] });
    deferred[0].resolve({ uri: 'file:///stale-cover.jpg' });
    await flush();

    expect(applySongMetadataPatches).not.toHaveBeenCalled();
    await waitFor(() => expect(mockRelease).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(2));
  });

  test('keeps protection until completed backfilled covers are owned by the songs snapshot', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue({ uri: 'file:///cover-a.jpg' });
    const applySongMetadataPatches = jest.fn();

    const { rerender } = renderHook(
      ({ value }: { value: Song[] }) => useLibraryCoverBackfill({ songs: value, setSongs: jest.fn(), applySongMetadataPatches }),
      { initialProps: { value: [song('a')] } },
    );

    await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalledWith({
      a: {
        cover: 'file:///cover-a.jpg',
        coverInfo: { status: 'cached', uri: 'file:///cover-a.jpg', embeddedArtworkChecked: true },
      },
    }));
    expect(mockRelease).not.toHaveBeenCalled();

    rerender({ value: [song('a', { cover: 'file:///cover-a.jpg', coverInfo: { status: 'cached', uri: 'file:///cover-a.jpg', embeddedArtworkChecked: true } })] });

    await waitFor(() => expect(mockRelease).toHaveBeenCalledTimes(1));
  });


  test('batches multiple completed covers and releases protection only after all cover uris are owned', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockImplementation(async (uri: string) => ({ uri: `${uri}.jpg` }));
    const applySongMetadataPatches = jest.fn();

    const { rerender } = renderHook(
      ({ value }: { value: Song[] }) => useLibraryCoverBackfill({ songs: value, setSongs: jest.fn(), applySongMetadataPatches }),
      { initialProps: { value: [song('a'), song('b')] } },
    );

    await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalledTimes(1));
    expect(applySongMetadataPatches).toHaveBeenCalledWith({
      a: { cover: 'file:///a.mp3.jpg', coverInfo: { status: 'cached', uri: 'file:///a.mp3.jpg', embeddedArtworkChecked: true } },
      b: { cover: 'file:///b.mp3.jpg', coverInfo: { status: 'cached', uri: 'file:///b.mp3.jpg', embeddedArtworkChecked: true } },
    });
    expect(mockRelease).not.toHaveBeenCalled();

    rerender({ value: [
      song('a', { cover: 'file:///a.mp3.jpg', coverInfo: { status: 'cached', uri: 'file:///a.mp3.jpg', embeddedArtworkChecked: true } }),
      song('b'),
    ] });
    await flush();
    expect(mockRelease).not.toHaveBeenCalled();

    rerender({ value: [
      song('a', { cover: 'file:///a.mp3.jpg', coverInfo: { status: 'cached', uri: 'file:///a.mp3.jpg', embeddedArtworkChecked: true } }),
      song('b', { cover: 'file:///b.mp3.jpg', coverInfo: { status: 'cached', uri: 'file:///b.mp3.jpg', embeddedArtworkChecked: true } }),
    ] });
    await waitFor(() => expect(mockRelease).toHaveBeenCalledTimes(1));
  });

  test('does not repeatedly retry completed coverless files while mounted', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue(undefined);
    const applySongMetadataPatches = jest.fn();
    const songs = [song('a')];

    const { rerender } = renderHook(
      ({ value }: { value: Song[] }) => useLibraryCoverBackfill({ songs: value, setSongs: jest.fn(), applySongMetadataPatches }),
      { initialProps: { value: songs } },
    );

    await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalledWith({
      a: {
        cover: undefined,
        coverInfo: { status: 'none', uri: undefined, embeddedArtworkChecked: true },
      },
    }));
    rerender({ value: [song('a')] });
    await flush();

    expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(1);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  test('does not retry persisted no-cover files after remount', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue(undefined);
    const applySongMetadataPatches = jest.fn();

    const first = renderHook(() => useLibraryCoverBackfill({
      songs: [song('a')],
      setSongs: jest.fn(),
      applySongMetadataPatches,
    }));

    await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalledWith({
      a: {
        cover: undefined,
        coverInfo: { status: 'none', uri: undefined, embeddedArtworkChecked: true },
      },
    }));
    expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(1);
    first.unmount();

    renderHook(() => useLibraryCoverBackfill({
      songs: [song('a', { coverInfo: { status: 'none', uri: undefined, embeddedArtworkChecked: true } })],
      setSongs: jest.fn(),
      applySongMetadataPatches,
    }));
    await flush();

    expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(1);
  });

  test('releases pending cover protection on unmount if snapshot never owns the uri', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue({ uri: 'file:///cover-a.jpg' });
    const applySongMetadataPatches = jest.fn();

    const rendered = renderHook(() => useLibraryCoverBackfill({ songs: [song('a')], setSongs: jest.fn(), applySongMetadataPatches }));

    await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalled());
    expect(mockRelease).not.toHaveBeenCalled();

    rendered.unmount();

    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  test('releases cover cache protection when backfill errors', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockRejectedValue(new Error('native failed'));

    renderHook(() => useLibraryCoverBackfill({ songs: [song('a')], setSongs: jest.fn(), applySongMetadataPatches: jest.fn() }));

    await waitFor(() => expect(mockRelease).toHaveBeenCalledTimes(1));
  });

  test('recovers volatile cached artwork through the bulk metadata path', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue({ uri: 'file:///cache/native-cover.jpg' });
    const applySongMetadataPatches = jest.fn();

    renderHook(() => useLibraryCoverBackfill({
      songs: [song('a', { cover: 'file:///cache/missing.jpg', coverInfo: { status: 'embedded', uri: 'file:///cache/missing.jpg', embeddedArtworkChecked: true } })],
      setSongs: jest.fn(),
      applySongMetadataPatches,
    }));

    await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalledWith({
      a: {
        cover: 'file:///docs/covers/native-cover.jpg',
        coverInfo: { status: 'cached', uri: 'file:///docs/covers/native-cover.jpg', embeddedArtworkChecked: true },
      },
    }));
  });
});
