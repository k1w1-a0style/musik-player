import { renderHook, waitFor } from '@testing-library/react-native';
import { useMemo, useRef, useState } from 'react';
import SystemAudio from 'expo-system-audio';
import { useLibraryActions } from '../../contexts/useLibraryActions';
import type { ScanFolder } from '../../types/ScanFolder';
import type { Song } from '../../types/Song';
import { getActiveLibrarySong } from '../../utils/librarySourceOwnership';
import {
  buildSafeAudioInfoBackfillPatches,
  useLibraryAudioInfoBackfill,
} from '../useLibraryAudioInfoBackfill';
import {
  backfillExistingSongAudioInfo,
  audioInfoRetryIsDeferred,
  buildAudioInfoBackfillAttemptKey,
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

  test('persists a bounded retry budget across serialized track snapshots and resets it on file revision', async () => {
    (SystemAudio.extractAudioInfo as jest.Mock).mockResolvedValue(null);
    let candidate = song('retry');
    for (let failures = 1; failures <= 3; failures++) {
      const result = await backfillExistingSongAudioInfo([candidate], { recordRetry: true });
      candidate = JSON.parse(JSON.stringify(result.songs[0])) as Song;
      expect(candidate.audioInfo?.backfillRetry).toMatchObject({ failures, reason: 'unavailable' });
      expect(audioInfoRetryIsDeferred(candidate)).toBe(true);
    }
    expect(candidate.audioInfo?.backfillRetry?.after).toBe(Number.MAX_SAFE_INTEGER);
    expect(audioInfoRetryIsDeferred({ ...candidate, fileInfo: { ...candidate.fileInfo, modificationTime: 42 } })).toBe(false);
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
        audioFileInfo: expect.objectContaining({
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

  test.each([
    { modificationTime: 2 },
    { contentHash: 'replacement-hash' },
    { importedAt: 2 },
  ])('rejects a pending result when the file revision changes to %o', revision => {
    const initial = song('a');
    const original = { ...initial, fileInfo: { ...initial.fileInfo, size: 1234 } };
    const replacement = { ...original, fileInfo: { ...original.fileInfo, ...revision } };
    const patched = { ...original, duration: 180000, audioInfo: { bitrate: 192 } };
    const originalAttempt = {
      originalSongs: [original],
      resultSongs: [patched],
      candidateKeys: new Set([buildAudioInfoBackfillAttemptKey(original)]),
    };
    expect(buildSafeAudioInfoBackfillPatches({ ...originalAttempt, currentSongs: [original] }))
      .toEqual({ a: { duration: 180000, audioInfo: { bitrate: 192 } } });
    expect(buildSafeAudioInfoBackfillPatches({ ...originalAttempt, currentSongs: [replacement] })).toEqual({});
  });

  test('reads a new file revision after attempting the same-sized previous file', async () => {
    jest.mocked(SystemAudio.extractAudioInfo).mockResolvedValue(null);
    const applySongMetadataPatches = jest.fn();
    const initial = song('a');
    const original = { ...initial, fileInfo: { ...initial.fileInfo, size: 1234, modificationTime: 1 } };
    const replacement = { ...original, fileInfo: { ...original.fileInfo, modificationTime: 2 } };
    const rendered = renderHook(({ songs }: { songs: Song[] }) => useLibraryAudioInfoBackfill({
      songs,
      applySongMetadataPatches,
    }), { initialProps: { songs: [original] } });

    await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalledTimes(1));
    rendered.rerender({ songs: [replacement] });
    await waitFor(() => expect(SystemAudio.extractAudioInfo).toHaveBeenCalledTimes(2));
  });

  test('backfills file facts without replacing distinct library and playback source URIs', async () => {
    const folderUri = 'content://provider/tree/album';
    const alias = folderUri + '/document/track';
    const initial = song('a');
    const folders: ScanFolder[] = [{ id: 'album', uri: folderUri, name: 'Album', addedAt: 1, enabled: true }];
    const original = { ...initial, fileInfo: { ...initial.fileInfo,
      librarySources: [folderUri, 'media-library'], librarySourceUris: { [folderUri]: alias } } };
    const selected = getActiveLibrarySong(original, folders)!;
    expect(selected.fileInfo?.uri).toBe(alias);
    jest.mocked(SystemAudio.extractAudioInfo).mockResolvedValue({
      durationMs: 180000, sizeBytes: 1234, bitrateBps: 192000, sampleRateHz: 44100, channels: 2,
    });

    const rendered = renderHook(() => {
      const [stored, setSongsState] = useState<Song[]>([original]);
      const [currentSong, setCurrentSong] = useState<Song | null>(selected);
      const [playbackQueue, setPlaybackQueue] = useState<Song[]>([selected]);
      const queueContextRef = useRef([selected]);
      const baseQueueContextRef = useRef([selected]);
      const nativeQueueRef = useRef<Song[]>([]);
      const { applySongMetadataPatches } = useLibraryActions({
        queueContextRef, baseQueueContextRef, nativeQueueRef, setSongsState, setCurrentSong, setPlaybackQueue,
        setPlaylists: () => undefined,
      });
      const active = useMemo(() => [getActiveLibrarySong(stored[0], folders)!], [stored]);
      useLibraryAudioInfoBackfill({ songs: active, applySongMetadataPatches });
      return { original: stored[0], currentSong, playbackQueue, queue: queueContextRef.current };
    });

    await waitFor(() => expect(rendered.result.current.original.fileInfo?.size).toBe(1234));
    expect(SystemAudio.extractAudioInfo).toHaveBeenCalledWith(alias);
    expect(rendered.result.current.original.fileInfo).toMatchObject({
      uri: original.fileInfo.uri, librarySources: original.fileInfo.librarySources,
    });
    expect(rendered.result.current.currentSong?.fileInfo).toMatchObject({ uri: alias, size: 1234 });
    expect(rendered.result.current.playbackQueue[0].fileInfo).toMatchObject({ uri: alias, size: 1234 });
    expect(rendered.result.current.queue[0].fileInfo).toMatchObject({ uri: alias, size: 1234 });
  });
});
