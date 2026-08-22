import { renderHook, waitFor } from '@testing-library/react-native';
import SystemAudio from 'expo-system-audio';
import type { Song } from '../../types/Song';
import {
  buildSafeAudioInfoBackfillPatches,
  useLibraryAudioInfoBackfill,
} from '../useLibraryAudioInfoBackfill';
import {
  backfillExistingSongAudioInfo,
  needsAudioInfoBackfill,
} from '../../utils/songAudioInfoBackfill';

jest.mock('expo-system-audio', () => {
  const mock = {
    extractAudioInfo: jest.fn(),
  };
  return {
    __esModule: true,
    default: mock,
    SystemAudio: mock,
  };
});

jest.mock('../useAfterInitialInteractions', () => ({
  useAfterInitialInteractions: () => true,
}));

const song = (id: string, patch: Partial<Song> = {}): Song => ({
  id,
  title: id,
  artist: 'Artist',
  uri: `file:///${id}.mp3`,
  fileInfo: {
    uri: `file:///${id}.mp3`,
    filename: `${id}.mp3`,
    extension: 'mp3',
    container: 'mp3',
    source: 'media-library',
    importedAt: 1,
  },
  ...patch,
});

describe('useLibraryAudioInfoBackfill', () => {
  beforeEach(() => {
    (SystemAudio.extractAudioInfo as jest.Mock).mockReset();
  });

  test('waits for completed music hydration before starting background audio-info work', async () => {
    (SystemAudio.extractAudioInfo as jest.Mock).mockResolvedValue(null);
    const applySongMetadataPatches = jest.fn();
    const rendered = renderHook(
      ({ enabled }: { enabled: boolean }) => useLibraryAudioInfoBackfill({
        songs: [song('a')],
        applySongMetadataPatches,
        enabled,
      }),
      { initialProps: { enabled: false } },
    );

    await Promise.resolve();
    expect(SystemAudio.extractAudioInfo).not.toHaveBeenCalled();

    rendered.rerender({ enabled: true });
    await waitFor(() => expect(SystemAudio.extractAudioInfo).toHaveBeenCalledTimes(1));
  });

  test('detects songs with missing audio information', () => {
    expect(needsAudioInfoBackfill(song('missing'))).toBe(true);
    expect(needsAudioInfoBackfill(song('remote', { uri: 'https://example.com/a.mp3', fileInfo: undefined }))).toBe(false);
    expect(needsAudioInfoBackfill(song('complete', {
      duration: 1000,
      fileInfo: {
        uri: 'file:///complete.mp3',
        filename: 'complete.mp3',
        extension: 'mp3',
        container: 'mp3',
        mimeType: 'audio/mpeg',
        size: 1234,
        source: 'media-library',
        importedAt: 1,
      },
      audioInfo: {
        codec: 'audio/mpeg',
        bitrate: 192,
        sampleRate: 44100,
        channels: 2,
      },
    }))).toBe(false);
  });

  test('backfills duration, file size and audio info without overwriting existing positive values', async () => {
    (SystemAudio.extractAudioInfo as jest.Mock).mockResolvedValue({
      durationMs: 120000,
      bitrateBps: 192000,
      sizeBytes: 3456789,
      sampleRateHz: 44100,
      channels: 2,
      mimeType: 'audio/mpeg',
      displayName: 'native.mp3',
    });

    const result = await backfillExistingSongAudioInfo([
      song('a', { duration: 999, audioInfo: { bitrate: 128 } }),
      song('b'),
    ], { concurrency: 1 });

    expect(result.attempted).toBe(2);
    expect(result.updated).toBe(2);
    expect(result.songs[0]).toMatchObject({
      duration: 999,
      audioInfo: {
        bitrate: 128,
        sampleRate: 44100,
        channels: 2,
      },
      fileInfo: {
        size: 3456789,
        mimeType: 'audio/mpeg',
      },
    });
    expect(result.songs[1]).toMatchObject({
      duration: 120000,
      audioInfo: {
        codec: 'audio/mpeg',
        bitrate: 192,
        sampleRate: 44100,
        channels: 2,
      },
      fileInfo: {
        size: 3456789,
        mimeType: 'audio/mpeg',
      },
    });
  });

  test('applies safe progressive metadata patches from the hook', async () => {
    (SystemAudio.extractAudioInfo as jest.Mock).mockResolvedValue({
      durationMs: 180000,
      bitrateBps: 256000,
      sizeBytes: 1234567,
      sampleRateHz: 48000,
      channels: 2,
      mimeType: 'audio/mpeg',
    });
    const applySongMetadataPatches = jest.fn();

    renderHook(() => useLibraryAudioInfoBackfill({
      songs: [song('a')],
      applySongMetadataPatches,
    }));

    await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalledWith({
      a: expect.objectContaining({
        duration: 180000,
        fileInfo: expect.objectContaining({
          size: 1234567,
          mimeType: 'audio/mpeg',
        }),
        audioInfo: expect.objectContaining({
          codec: 'audio/mpeg',
          bitrate: 256,
          sampleRate: 48000,
          channels: 2,
        }),
      }),
    }));
  });

  test('drops stale patches when the current song snapshot changed', () => {
    const original = song('a');
    const patched = song('a', {
      duration: 180000,
      audioInfo: { bitrate: 192 },
    });
    const current = song('a', { title: 'renamed while backfill ran' });

    expect(buildSafeAudioInfoBackfillPatches({
      originalSongs: [original],
      resultSongs: [patched],
      currentSongs: [current],
      candidateKeys: new Set(['not-the-current-key']),
    })).toEqual({});
  });
});
