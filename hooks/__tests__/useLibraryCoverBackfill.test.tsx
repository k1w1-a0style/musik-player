import { renderHook, waitFor } from '@testing-library/react-native';
import SystemAudio from 'expo-system-audio';
import { useLibraryCoverBackfill } from '../useLibraryCoverBackfill';
import type { Song } from '../../types/Song';

jest.mock('expo-system-audio', () => ({
  extractEmbeddedArtwork: jest.fn(),
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
    await waitFor(() => expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(2));
  });

  test('propagates completed backfilled covers through the bulk metadata path', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue({ uri: 'file:///cover-a.jpg' });
    const applySongMetadataPatches = jest.fn();

    renderHook(() => useLibraryCoverBackfill({ songs: [song('a')], setSongs: jest.fn(), applySongMetadataPatches }));

    await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalledWith({
      a: {
        cover: 'file:///cover-a.jpg',
        coverInfo: { status: 'embedded', uri: 'file:///cover-a.jpg' },
      },
    }));
  });


  test('batches multiple completed covers into one bulk metadata call', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockImplementation(async (uri: string) => ({ uri: `${uri}.jpg` }));
    const applySongMetadataPatches = jest.fn();

    renderHook(() => useLibraryCoverBackfill({ songs: [song('a'), song('b')], setSongs: jest.fn(), applySongMetadataPatches }));

    await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalledTimes(1));
    expect(applySongMetadataPatches).toHaveBeenCalledWith({
      a: { cover: 'file:///a.mp3.jpg', coverInfo: { status: 'embedded', uri: 'file:///a.mp3.jpg' } },
      b: { cover: 'file:///b.mp3.jpg', coverInfo: { status: 'embedded', uri: 'file:///b.mp3.jpg' } },
    });
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
        coverInfo: { status: 'none', uri: undefined },
      },
    }));
    rerender({ value: [song('a')] });
    await flush();

    expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(1);
  });
});
