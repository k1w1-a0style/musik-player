import { renderHook, waitFor } from '@testing-library/react-native';
import SystemAudio from 'expo-system-audio';
import { buildCoverBackfillAttemptKey, useLibraryCoverBackfill } from '../useLibraryCoverBackfill';
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
    const applySongMetadataPatches = jest.fn();
    const songs = [song('a')];

    const { rerender } = renderHook(
      ({ value }: { value: Song[] }) => useLibraryCoverBackfill({ songs: value, applySongMetadataPatches }),
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

  test('discards aborted partial results after the cleanup snapshot no longer needs backfill', async () => {
    let secondResolve: (value: { uri: string }) => void = () => {};
    (SystemAudio.extractEmbeddedArtwork as jest.Mock)
      .mockResolvedValueOnce({ uri: 'file:///stale-cover-a.jpg' })
      .mockImplementationOnce(() => new Promise(resolve => {
        secondResolve = resolve;
      }));
    const applySongMetadataPatches = jest.fn();

    const { rerender } = renderHook(
      ({ value }: { value: Song[] }) => useLibraryCoverBackfill({ songs: value, applySongMetadataPatches }),
      { initialProps: { value: [song('a'), song('b')] } },
    );

    await waitFor(() => expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(2));
    rerender({
      value: [
        song('a', { cover: 'file:///fresh-cover-a.jpg', coverInfo: { status: 'cached', uri: 'file:///fresh-cover-a.jpg', embeddedArtworkChecked: true } }),
        song('b', { coverInfo: { status: 'none', uri: undefined, embeddedArtworkChecked: true } }),
      ],
    });
    secondResolve({ uri: 'file:///stale-cover-b.jpg' });
    await flush();

    expect(applySongMetadataPatches).not.toHaveBeenCalled();
    await waitFor(() => expect(mockRelease).toHaveBeenCalledTimes(1));
  });

  test('keeps safe partial cover patches from a normal songs-change abort', async () => {
    let secondResolve: (value: { uri: string }) => void = () => {};
    (SystemAudio.extractEmbeddedArtwork as jest.Mock)
      .mockResolvedValueOnce({ uri: 'file:///cover-a.jpg' })
      .mockImplementationOnce(() => new Promise(resolve => {
        secondResolve = resolve;
      }))
      .mockResolvedValue({ uri: 'file:///later-cover.jpg' });
    const applySongMetadataPatches = jest.fn();

    const { rerender } = renderHook(
      ({ value }: { value: Song[] }) => useLibraryCoverBackfill({ songs: value, applySongMetadataPatches }),
      { initialProps: { value: [song('a'), song('b')] } },
    );

    await waitFor(() => expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(2));
    rerender({ value: [song('a', { title: 'renamed-a' }), song('b', { title: 'renamed-b' })] });
    secondResolve({ uri: 'file:///stale-cover-b.jpg' });

    await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalledWith({
      a: {
        cover: 'file:///cover-a.jpg',
        coverInfo: { status: 'cached', uri: 'file:///cover-a.jpg', embeddedArtworkChecked: true },
      },
    }));
    expect(mockRelease).not.toHaveBeenCalled();

    rerender({
      value: [
        song('a', { title: 'renamed-a', cover: 'file:///cover-a.jpg', coverInfo: { status: 'cached', uri: 'file:///cover-a.jpg', embeddedArtworkChecked: true } }),
        song('b', { title: 'renamed-b' }),
      ],
    });
    await waitFor(() => expect(mockRelease).toHaveBeenCalledTimes(1));
  });

  test('discards aborted partial results after unmount', async () => {
    let secondResolve: (value: { uri: string }) => void = () => {};
    (SystemAudio.extractEmbeddedArtwork as jest.Mock)
      .mockResolvedValueOnce({ uri: 'file:///cover-a.jpg' })
      .mockImplementationOnce(() => new Promise(resolve => {
        secondResolve = resolve;
      }));
    const applySongMetadataPatches = jest.fn();

    const rendered = renderHook(() => useLibraryCoverBackfill({
      songs: [song('a'), song('b')],
      applySongMetadataPatches,
    }));

    await waitFor(() => expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(2));
    rendered.unmount();
    secondResolve({ uri: 'file:///stale-cover-b.jpg' });
    await flush();

    expect(applySongMetadataPatches).not.toHaveBeenCalled();
    await waitFor(() => expect(mockRelease).toHaveBeenCalledTimes(1));
  });

  test('does not let an older aborted partial patch a changed newer backfill candidate', async () => {
    let secondResolve: (value: { uri: string }) => void = () => {};
    (SystemAudio.extractEmbeddedArtwork as jest.Mock)
      .mockResolvedValueOnce({ uri: 'file:///old-cover-a.jpg' })
      .mockImplementationOnce(() => new Promise(resolve => {
        secondResolve = resolve;
      }))
      .mockResolvedValue({ uri: 'file:///new-cover-a.jpg' });
    const applySongMetadataPatches = jest.fn();

    const { rerender } = renderHook(
      ({ value }: { value: Song[] }) => useLibraryCoverBackfill({ songs: value, applySongMetadataPatches }),
      { initialProps: { value: [song('a'), song('b')] } },
    );

    await waitFor(() => expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(2));
    rerender({ value: [song('a', { uri: 'file:///a-new.mp3' }), song('b', { uri: 'file:///b-new.mp3' })] });
    secondResolve({ uri: 'file:///old-cover-b.jpg' });
    await flush();

    expect(applySongMetadataPatches).not.toHaveBeenCalledWith({
      a: expect.objectContaining({ cover: 'file:///old-cover-a.jpg' }),
    });
    await waitFor(() => expect(mockRelease).toHaveBeenCalledTimes(1));
  });

  test('keeps protection until completed backfilled covers are owned by the songs snapshot', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue({ uri: 'file:///cover-a.jpg' });
    const applySongMetadataPatches = jest.fn();

    const { rerender } = renderHook(
      ({ value }: { value: Song[] }) => useLibraryCoverBackfill({ songs: value, applySongMetadataPatches }),
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
      ({ value }: { value: Song[] }) => useLibraryCoverBackfill({ songs: value, applySongMetadataPatches }),
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


  test('includes embedded artwork revision in the backfill attempt key', () => {
    const firstReplacement = song('a', { cover: 'file:///first-preview.jpg', coverInfo: { status: 'external', uri: 'file:///first-preview.jpg', embeddedArtworkChecked: false, embeddedArtworkRevision: 1, pendingEmbeddedArtworkRefresh: true, embeddedArtworkRefreshFailed: false } });
    const secondReplacement = song('a', { cover: 'file:///second-preview.jpg', coverInfo: { status: 'external', uri: 'file:///second-preview.jpg', embeddedArtworkChecked: false, embeddedArtworkRevision: 2, pendingEmbeddedArtworkRefresh: true, embeddedArtworkRefreshFailed: false } });
    const legacyReplacement = song('a', { coverInfo: { status: 'embedded', uri: undefined, embeddedArtworkChecked: false } });

    expect(buildCoverBackfillAttemptKey(firstReplacement)).not.toBe(buildCoverBackfillAttemptKey(secondReplacement));
    expect(buildCoverBackfillAttemptKey(legacyReplacement)).toBe('a|file:///a.mp3||embedded|unchecked|');
  });

  test('retries backfill for repeated tag cover replacement revisions without looping after completion', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock)
      .mockResolvedValueOnce({ uri: 'file:///first-cover.jpg' })
      .mockResolvedValueOnce({ uri: 'file:///second-cover.jpg' });
    const applySongMetadataPatches = jest.fn();
    const firstReplacement = song('a', { cover: 'file:///first-preview.jpg', coverInfo: { status: 'external', uri: 'file:///first-preview.jpg', embeddedArtworkChecked: false, embeddedArtworkRevision: 1, pendingEmbeddedArtworkRefresh: true, embeddedArtworkRefreshFailed: false } });

    const { rerender } = renderHook(
      ({ value }: { value: Song[] }) => useLibraryCoverBackfill({ songs: value, applySongMetadataPatches }),
      { initialProps: { value: [firstReplacement] } },
    );

    await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalledWith({
      a: {
        cover: 'file:///first-cover.jpg',
        coverInfo: { status: 'cached', uri: 'file:///first-cover.jpg', embeddedArtworkChecked: true, embeddedArtworkRevision: 1, pendingEmbeddedArtworkRefresh: false, embeddedArtworkRefreshFailed: false },
      },
    }));

    rerender({ value: [song('a', { cover: 'file:///first-cover.jpg', coverInfo: { status: 'cached', uri: 'file:///first-cover.jpg', embeddedArtworkChecked: true, embeddedArtworkRevision: 1 } })] });
    await flush();
    expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(1);

    rerender({ value: [song('a', { cover: 'file:///second-preview.jpg', coverInfo: { status: 'external', uri: 'file:///second-preview.jpg', embeddedArtworkChecked: false, embeddedArtworkRevision: 2, pendingEmbeddedArtworkRefresh: true, embeddedArtworkRefreshFailed: false } })] });

    await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalledWith({
      a: {
        cover: 'file:///second-cover.jpg',
        coverInfo: { status: 'cached', uri: 'file:///second-cover.jpg', embeddedArtworkChecked: true, embeddedArtworkRevision: 2, pendingEmbeddedArtworkRefresh: false, embeddedArtworkRefreshFailed: false },
      },
    }));
    expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(2);

    rerender({ value: [song('a', { cover: 'file:///second-cover.jpg', coverInfo: { status: 'cached', uri: 'file:///second-cover.jpg', embeddedArtworkChecked: true, embeddedArtworkRevision: 2 } })] });
    await flush();
    expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(2);
  });

  test('does not repeatedly retry completed coverless files while mounted', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue(undefined);
    const applySongMetadataPatches = jest.fn();
    const songs = [song('a')];

    const { rerender } = renderHook(
      ({ value }: { value: Song[] }) => useLibraryCoverBackfill({ songs: value, applySongMetadataPatches }),
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
      applySongMetadataPatches,
    }));
    await flush();

    expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(1);
  });


  test('keeps one progressive protection alive across multiple flush batches until all uris are owned', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockImplementation(async (uri: string) => ({ uri: `${uri}.jpg` }));
    const applySongMetadataPatches = jest.fn();
    const initialSongs = ['a', 'b', 'c', 'd', 'e'].map(id => song(id));

    const { rerender } = renderHook(
      ({ value }: { value: Song[] }) => useLibraryCoverBackfill({ songs: value, applySongMetadataPatches }),
      { initialProps: { value: initialSongs } },
    );

    await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalledTimes(2));
    expect(applySongMetadataPatches).toHaveBeenNthCalledWith(1, expect.objectContaining({
      a: expect.objectContaining({ cover: 'file:///a.mp3.jpg' }),
      b: expect.objectContaining({ cover: 'file:///b.mp3.jpg' }),
      c: expect.objectContaining({ cover: 'file:///c.mp3.jpg' }),
      d: expect.objectContaining({ cover: 'file:///d.mp3.jpg' }),
    }));
    expect(applySongMetadataPatches).toHaveBeenNthCalledWith(2, {
      e: { cover: 'file:///e.mp3.jpg', coverInfo: { status: 'cached', uri: 'file:///e.mp3.jpg', embeddedArtworkChecked: true } },
    });

    rerender({
      value: [
        song('a', { cover: 'file:///a.mp3.jpg', coverInfo: { status: 'cached', uri: 'file:///a.mp3.jpg', embeddedArtworkChecked: true } }),
        song('b', { cover: 'file:///b.mp3.jpg', coverInfo: { status: 'cached', uri: 'file:///b.mp3.jpg', embeddedArtworkChecked: true } }),
        song('c', { cover: 'file:///c.mp3.jpg', coverInfo: { status: 'cached', uri: 'file:///c.mp3.jpg', embeddedArtworkChecked: true } }),
        song('d', { cover: 'file:///d.mp3.jpg', coverInfo: { status: 'cached', uri: 'file:///d.mp3.jpg', embeddedArtworkChecked: true } }),
        song('e'),
      ],
    });
    await flush();

    expect(mockRelease).not.toHaveBeenCalled();

    rerender({
      value: ['a', 'b', 'c', 'd', 'e'].map(id => song(id, {
        cover: `file:///${id}.mp3.jpg`,
        coverInfo: { status: 'cached', uri: `file:///${id}.mp3.jpg`, embeddedArtworkChecked: true },
      })),
    });

    await waitFor(() => expect(mockRelease).toHaveBeenCalledTimes(1));
    expect(applySongMetadataPatches).toHaveBeenCalledTimes(2);
  });

  test('releases pending cover protection on unmount if snapshot never owns the uri', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue({ uri: 'file:///cover-a.jpg' });
    const applySongMetadataPatches = jest.fn();

    const rendered = renderHook(() => useLibraryCoverBackfill({ songs: [song('a')], applySongMetadataPatches }));

    await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalled());
    expect(mockRelease).not.toHaveBeenCalled();

    rendered.unmount();

    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  test('releases cover cache protection when backfill errors', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockRejectedValue(new Error('native failed'));

    renderHook(() => useLibraryCoverBackfill({ songs: [song('a')], applySongMetadataPatches: jest.fn() }));

    await waitFor(() => expect(mockRelease).toHaveBeenCalledTimes(1));
  });

  test('recovers volatile cached artwork through the bulk metadata path', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue({ uri: 'file:///cache/native-cover.jpg' });
    const applySongMetadataPatches = jest.fn();

    renderHook(() => useLibraryCoverBackfill({
      songs: [song('a', { cover: 'file:///cache/missing.jpg', coverInfo: { status: 'embedded', uri: 'file:///cache/missing.jpg', embeddedArtworkChecked: true } })],
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
