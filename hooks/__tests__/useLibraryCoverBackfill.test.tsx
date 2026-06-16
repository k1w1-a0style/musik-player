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
    const updateSongMetadata = jest.fn();
    const songs = [song('a')];

    const { rerender } = renderHook(
      ({ value }: { value: Song[] }) => useLibraryCoverBackfill({ songs: value, setSongs, updateSongMetadata }),
      { initialProps: { value: songs } },
    );

    await waitFor(() => expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(1));
    rerender({ value: [song('a', { title: 'renamed' })] });
    deferred[0].resolve({ uri: 'file:///stale-cover.jpg' });
    await flush();

    expect(updateSongMetadata).not.toHaveBeenCalled();
    await waitFor(() => expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(2));
  });

  test('propagates completed backfilled covers through updateSongMetadata', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue({ uri: 'file:///cover-a.jpg' });
    const updateSongMetadata = jest.fn();

    renderHook(() => useLibraryCoverBackfill({ songs: [song('a')], setSongs: jest.fn(), updateSongMetadata }));

    await waitFor(() => expect(updateSongMetadata).toHaveBeenCalledWith('a', {
      cover: 'file:///cover-a.jpg',
      coverInfo: { status: 'embedded', uri: 'file:///cover-a.jpg' },
    }));
  });

  test('does not repeatedly retry completed coverless files while mounted', async () => {
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue(undefined);
    const updateSongMetadata = jest.fn();
    const songs = [song('a')];

    const { rerender } = renderHook(
      ({ value }: { value: Song[] }) => useLibraryCoverBackfill({ songs: value, setSongs: jest.fn(), updateSongMetadata }),
      { initialProps: { value: songs } },
    );

    await waitFor(() => expect(updateSongMetadata).toHaveBeenCalledWith('a', {
      cover: undefined,
      coverInfo: { status: 'none', uri: undefined },
    }));
    rerender({ value: [song('a')] });
    await flush();

    expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledTimes(1);
  });
});
