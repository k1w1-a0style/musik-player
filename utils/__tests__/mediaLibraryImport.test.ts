import { StorageAccessFramework } from 'expo-file-system/legacy';
import { cacheBase64Cover } from '../coverCache';
import { parseId3FromUri } from '../id3Parser';
import SystemAudio from 'expo-system-audio';
import * as mediaImport from '../mediaLibraryImport';
import { AUDIO_EXTENSIONS, EXTENSION_MIME_MAP, KNOWN_NON_AUDIO_EXTENSIONS } from '../audioExtensions';

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(async () => ({ exists: true, size: 123 })),
  StorageAccessFramework: { readDirectoryAsync: jest.fn(async () => []) },
}));
jest.mock('../id3Parser', () => ({ parseId3FromUri: jest.fn(async () => ({})) }));
jest.mock('../coverCache', () => ({
  cacheBase64Cover: jest.fn(async (_id: string, c?: string) =>
    c ? 'file:///cover.jpg' : undefined,
  ),
  isBase64ImageDataUri: (v?: string) => !!v?.startsWith('data:image/'),
}));

describe('mediaLibraryImport', () => {
  beforeEach(() => {
    jest.useRealTimers();
    mediaImport.resetSafTimedOutUrisForTests();
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockReset();
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
    (SystemAudio.extractAudioInfo as jest.Mock).mockReset();
    (SystemAudio.extractAudioInfo as jest.Mock).mockResolvedValue(null);
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockReset();
    (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
    mediaImport.resetSafTimedOutUrisForTests();
  });

  test('SAF directory timeout defaults to 4000ms', () => {
    expect(mediaImport.DEFAULT_SAF_READ_DIRECTORY_TIMEOUT_MS).toBe(4000);
  });

  test('maps opus extension to the audio/opus MIME type', () => {
    expect(EXTENSION_MIME_MAP.opus).toBe('audio/opus');
    expect(mediaImport.deriveMimeType(undefined, 'opus')).toBe('audio/opus');
  });

  test('readSafDirectoryWithTimeout returns successful SAF directory entries and clears its timer', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const read = jest.fn(async () => ['content://root/song.mp3']);

    await expect(
      mediaImport.readSafDirectoryWithTimeout('content://root', read, { readTimeoutMs: 100 }),
    ).resolves.toEqual(['content://root/song.mp3']);

    expect(read).toHaveBeenCalledWith('content://root');
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  test('readSafDirectoryWithTimeout marks timeout distinctly and clears its timer', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const read = jest.fn(() => new Promise<string[]>(() => undefined));

    await expect(
      mediaImport.readSafDirectoryWithTimeout('content://root/hangs', read, { readTimeoutMs: 1 }),
    ).rejects.toBeInstanceOf(mediaImport.SafDirectoryReadTimeoutError);

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  test('readSafDirectoryWithTimeout marks abort distinctly and removes its abort listener', async () => {
    const controller = new AbortController();
    const addListenerSpy = jest.spyOn(controller.signal, 'addEventListener');
    const removeListenerSpy = jest.spyOn(controller.signal, 'removeEventListener');
    const read = jest.fn(() => new Promise<string[]>(() => undefined));

    const resultPromise = mediaImport.readSafDirectoryWithTimeout('content://root/abort', read, {
      signal: controller.signal,
      readTimeoutMs: 10_000,
    });
    controller.abort(new Error('user cancelled'));

    await expect(resultPromise).rejects.toBeInstanceOf(mediaImport.SafDirectoryReadAbortedError);
    expect(addListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function), { once: true });
    expect(removeListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  test('readSafDirectoryWithTimeout wraps native read failures distinctly', async () => {
    const read = jest.fn(async () => {
      throw new Error('provider failed');
    });

    await expect(
      mediaImport.readSafDirectoryWithTimeout('content://root/native', read, { readTimeoutMs: 100 }),
    ).rejects.toBeInstanceOf(mediaImport.SafDirectoryNativeReadError);
  });

  test('readSafDirectoryWithTimeout timeout does not create an unhandled native rejection', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    let rejectNative: ((error: Error) => void) | undefined;
    const read = jest.fn(
      () => new Promise<string[]>((_resolve, reject) => {
        rejectNative = reject;
      }),
    );

    await expect(
      mediaImport.readSafDirectoryWithTimeout('content://root/hangs-then-fails', read, {
        readTimeoutMs: 1,
      }),
    ).rejects.toBeInstanceOf(mediaImport.SafDirectoryReadTimeoutError);

    rejectNative?.(new Error('late native failure'));
    await new Promise(resolve => setTimeout(resolve, 0));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  test('SAF timeout session skip blocks only the timed-out URI and is resettable', async () => {
    const read = jest.fn((uri: string) => {
      if (uri === 'content://root/hangs') return new Promise<string[]>(() => undefined);
      return Promise.resolve([`${uri}/song.mp3`]);
    });

    await expect(
      mediaImport.readSafDirectoryWithTimeout('content://root/hangs', read, { readTimeoutMs: 1 }),
    ).rejects.toBeInstanceOf(mediaImport.SafDirectoryReadTimeoutError);
    await expect(
      mediaImport.readSafDirectoryWithTimeout('content://root/hangs', read, { readTimeoutMs: 1 }),
    ).rejects.toBeInstanceOf(mediaImport.SafDirectoryReadSessionSkipError);
    await expect(
      mediaImport.readSafDirectoryWithTimeout('content://root/other', read, { readTimeoutMs: 100 }),
    ).resolves.toEqual(['content://root/other/song.mp3']);

    expect(read).toHaveBeenCalledTimes(2);
    mediaImport.resetSafTimedOutUrisForTests();
    await expect(
      mediaImport.readSafDirectoryWithTimeout('content://root/hangs', async () => ['content://root/hangs/retry.mp3'], {
        readTimeoutMs: 100,
      }),
    ).resolves.toEqual(['content://root/hangs/retry.mp3']);
  });

  test('classifySafReadDirectoryError classifies directory/access/unknown errors', () => {
    expect(mediaImport.classifySafReadDirectoryError(new Error('ENOTDIR'))).toBe(
      'not-directory',
    );
    expect(mediaImport.classifySafReadDirectoryError('this is not a directory')).toBe(
      'not-directory',
    );
    expect(
      mediaImport.classifySafReadDirectoryError(
        new Error('SecurityException: Permission denied'),
      ),
    ).toBe('permission');
    expect(
      mediaImport.classifySafReadDirectoryError(
        new Error("Location 'content://x' isn't readable."),
      ),
    ).toBe('permission');
    expect(
      mediaImport.classifySafReadDirectoryError(
        new Error("Location 'content://x' is not readable."),
      ),
    ).toBe('permission');
    expect(mediaImport.classifySafReadDirectoryError(new Error('not readable'))).toBe(
      'permission',
    );
    expect(mediaImport.classifySafReadDirectoryError(new Error('cannot read'))).toBe(
      'permission',
    );
    expect(
      mediaImport.classifySafReadDirectoryError(new Error('failed to read children')),
    ).toBe('permission');
    expect(mediaImport.classifySafReadDirectoryError(new Error('EACCES'))).toBe(
      'permission',
    );
    expect(
      mediaImport.classifySafReadDirectoryError(
        new Error('EPERM operation not permitted'),
      ),
    ).toBe('permission');
    expect(mediaImport.classifySafReadDirectoryError(new Error('random failure'))).toBe(
      'unknown',
    );
    expect(
      mediaImport.classifySafReadDirectoryError(
        new mediaImport.SafDirectoryReadTimeoutError('content://x', 1),
      ),
    ).toBe('timeout');
    expect(
      mediaImport.classifySafReadDirectoryError(
        new mediaImport.SafDirectoryReadAbortedError('content://x', new Error('stop')),
      ),
    ).toBe('aborted');
    expect(
      mediaImport.classifySafReadDirectoryError(
        new mediaImport.SafDirectoryNativeReadError('content://x', new Error('provider failed')),
      ),
    ).toBe('native');
    expect(
      mediaImport.classifySafReadDirectoryError(
        new mediaImport.SafDirectoryReadSessionSkipError('content://x'),
      ),
    ).toBe('session-skip');
  });


  test('saf scan skips malformed directory entries without crashing', async () => {
    const read = jest.fn(async () => [
      null,
      undefined,
      '',
      'content://root/valid.mp3',
    ]) as any;

    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', read);

    expect(result.files).toEqual(['content://root/valid.mp3']);
    expect(result.errors).toEqual(['content://root']);
  });

  test('saf scan treats malformed directory payload as a controlled folder error', async () => {
    const read = jest.fn(async () => null) as any;

    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', read);

    expect(result.files).toEqual([]);
    expect(result.errors).toEqual(['content://root']);
  });

  const mediaAsset = (
    id: string,
    filename: string,
    duration?: number,
    uri = `file:///music/${filename}`,
    mimeType?: string,
    mediaType?: 'audio' | 'photo' | 'video' | 'unknown',
  ) => ({
    id,
    filename,
    duration,
    uri,
    mimeType,
    mediaType,
  });

  const getSingleMediaLibraryPage = (...assets: Array<ReturnType<typeof mediaAsset>>) => jest.fn(async () => ({
    assets,
    hasNextPage: false,
    endCursor: undefined,
  })) as any;

  test('enrichMediaLibraryAssets uses native duration when MediaLibrary duration is zero', async () => {
    (SystemAudio.extractAudioInfo as jest.Mock).mockResolvedValueOnce({
      durationMs: 245000,
      sizeBytes: 9_800_000,
    });

    const result = await mediaImport.enrichMediaLibraryAssets([
      mediaAsset('native-duration-zero', 'native-zero.mp3', 0, 'file:///music/native-zero.mp3', 'audio/mpeg') as any,
    ], 0, { loadNativeCover: false, readId3Tags: false });

    expect(result.songs[0].duration).toBe(245000);
    expect(result.songs[0].fileInfo?.size).toBe(9_800_000);
    expect(result.songs[0].audioInfo?.bitrate).toBe(320);
  });

  test('enrichMediaLibraryAssets uses native duration when MediaLibrary duration is missing', async () => {
    (SystemAudio.extractAudioInfo as jest.Mock).mockResolvedValueOnce({ durationMs: 245000 });

    const result = await mediaImport.enrichMediaLibraryAssets([
      mediaAsset('native-duration-missing', 'native-missing.mp3', undefined, 'file:///music/native-missing.mp3', 'audio/mpeg') as any,
    ], 0, { loadNativeCover: false, readId3Tags: false });

    expect(result.songs[0].duration).toBe(245000);
  });

  test('enrichMediaLibraryAssets keeps positive MediaLibrary duration over native duration', async () => {
    (SystemAudio.extractAudioInfo as jest.Mock).mockResolvedValueOnce({ durationMs: 245000 });

    const result = await mediaImport.enrichMediaLibraryAssets([
      mediaAsset('media-duration', 'media-duration.mp3', 120, 'file:///music/media-duration.mp3', 'audio/mpeg') as any,
    ], 0, { loadNativeCover: false, readId3Tags: false });

    expect(result.songs[0].duration).toBe(120000);
  });

  test('extractAudioInfo failures do not abort MediaLibrary import', async () => {
    (SystemAudio.extractAudioInfo as jest.Mock).mockRejectedValueOnce(new Error('native failed'));

    const result = await mediaImport.enrichMediaLibraryAssets([
      mediaAsset('native-error', 'native-error.mp3', 120, 'file:///music/native-error.mp3', 'audio/mpeg') as any,
    ], 0, { loadNativeCover: false, readId3Tags: false });

    expect(result.songs).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  test('scanAudioAssetsFromMediaLibrary uses the default 45-second filter and stable skipped reasons', async () => {
    const short = mediaAsset('short', 'short-click.mp3', 3);
    const full = mediaAsset('full', 'full-song.mp3', 180, undefined, 'audio/mpeg');
    const getAssetsPage = getSingleMediaLibraryPage(short, full);

    const result = await mediaImport.scanAudioAssetsFromMediaLibrary(getAssetsPage);

    expect(result.assets.map(asset => asset.id)).toEqual(['full']);
    expect(result.skipped).toEqual([{ asset: short, reason: 'shorter-than-45s' }]);
  });

  test('scanAudioAssetsFromMediaLibrary keeps likely-music filtering fully disabled when requested', async () => {
    const short = mediaAsset('short', 'short-click.mp3', 3);
    const notification = mediaAsset('notification', 'ping.mp3', 90, 'file:///storage/emulated/0/Notifications/ping.mp3');
    const unknown = mediaAsset('unknown', 'unknown.bin', 90, undefined, undefined, 'photo');
    const getAssetsPage = getSingleMediaLibraryPage(short, notification, unknown);

    const result = await mediaImport.scanAudioAssetsFromMediaLibrary(getAssetsPage, { filterLikelyMusic: false });

    expect(result.assets.map(asset => asset.id)).toEqual(['short', 'notification', 'unknown']);
    expect(result.skipped).toEqual([]);
  });

  test('scanAudioAssetsFromMediaLibrary passes custom minimum duration into the filter', async () => {
    const short = mediaAsset('short', 'short-song.mp3', 30);
    const getAssetsPage = getSingleMediaLibraryPage(short);

    await expect(mediaImport.scanAudioAssetsFromMediaLibrary(getAssetsPage)).resolves.toMatchObject({
      assets: [],
      skipped: [{ asset: short, reason: 'shorter-than-45s' }],
    });
    await expect(
      mediaImport.scanAudioAssetsFromMediaLibrary(getAssetsPage, { minMusicDurationSeconds: 30 }),
    ).resolves.toMatchObject({ assets: [short], skipped: [] });
  });

  test('scanAudioAssetsFromMediaLibrary can disable only duration filtering', async () => {
    const short = mediaAsset('short', 'short-song.mp3', 3);
    const nonAudio = mediaAsset('cover', 'cover.jpg', 180, undefined, 'image/jpeg');
    const getAssetsPage = getSingleMediaLibraryPage(short, nonAudio);

    const result = await mediaImport.scanAudioAssetsFromMediaLibrary(getAssetsPage, { enableDurationFilter: false });

    expect(result.assets).toEqual([short]);
    expect(result.skipped).toEqual([{ asset: nonAudio, reason: 'not-audio' }]);
  });

  test('scanAudioAssetsFromMediaLibrary imports MediaLibrary audio assets with unlisted extensions', async () => {
    const audiobook = mediaAsset('audiobook', 'audiobook.m4b', 180, undefined, undefined, 'audio');
    const getAssetsPage = getSingleMediaLibraryPage(audiobook);

    const result = await mediaImport.scanAudioAssetsFromMediaLibrary(getAssetsPage);

    expect(result.assets).toEqual([audiobook]);
    expect(result.skipped).toEqual([]);
  });

  test('scanAudioAssetsFromMediaLibrary skips explicit non-audio media types even with whitelisted extensions', async () => {
    const video = mediaAsset('video', 'clip.mp4', 180, undefined, undefined, 'video');
    const photo = mediaAsset('photo', 'track.mp3', 180, undefined, undefined, 'photo');
    const getAssetsPage = getSingleMediaLibraryPage(video, photo);

    const result = await mediaImport.scanAudioAssetsFromMediaLibrary(getAssetsPage);

    expect(result.assets).toEqual([]);
    expect(result.skipped).toEqual([
      { asset: video, reason: 'not-audio' },
      { asset: photo, reason: 'not-audio' },
    ]);
  });

  test('scanAudioAssetsFromMediaLibrary still applies duration filtering to mediaType audio assets', async () => {
    const shortAudiobook = mediaAsset('short-audiobook', 'short-audiobook.m4b', 3, undefined, undefined, 'audio');
    const getAssetsPage = getSingleMediaLibraryPage(shortAudiobook);

    const result = await mediaImport.scanAudioAssetsFromMediaLibrary(getAssetsPage);

    expect(result.assets).toEqual([]);
    expect(result.skipped).toEqual([{ asset: shortAudiobook, reason: 'shorter-than-45s' }]);
  });

  test('loads all pages', async () => {
    const getAssetsPage = jest.fn(async ({ after }: { after?: string }) =>
      !after
        ? { assets: [mediaAsset('1', 'one.mp3', 90), mediaAsset('2', 'two.mp3', 90)], hasNextPage: true, endCursor: 'a' }
        : { assets: [mediaAsset('3', 'three.mp3', 90)], hasNextPage: false, endCursor: 'b' },
    ) as any;
    const result = await mediaImport.loadAllAudioAssetsFromMediaLibrary(getAssetsPage);
    expect(result.map(a => a.id)).toEqual(['1', '2', '3']);
  });

  test('saf scan enters dotted folders like AC.DC and Vol.1', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root')
        return ['content://root/AC.DC', 'content://root/Vol.1'];
      if (uri === 'content://root/AC.DC') return ['content://root/AC.DC/a.mp3'];
      if (uri === 'content://root/Vol.1') return ['content://root/Vol.1/b.flac'];
      throw new Error('not-dir');
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory(
      'content://root',
      read,
    );
    expect(result.files).toEqual(
      expect.arrayContaining([
        'content://root/AC.DC/a.mp3',
        'content://root/Vol.1/b.flac',
      ]),
    );
  });

  test('known and unknown non-audio child read failures do not produce SAF errors', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') {
        return [
          'content://root/cover.jpg',
          'content://root/folder.jpg',
          'content://root/playlist.m3u',
          'content://root/README',
          'content://root/.nomedia',
          'content://root/unknownSidecar',
          'content://root/notes.xyz',
        ];
      }
      throw new Error('ENOTDIR not a directory');
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory(
      'content://root',
      read,
    );
    expect(result.errors).toEqual([]);
    expect(result.files).toEqual([]);
    expect(read).not.toHaveBeenCalledWith('content://root/cover.jpg');
    expect(read).not.toHaveBeenCalledWith('content://root/folder.jpg');
    expect(read).not.toHaveBeenCalledWith('content://root/playlist.m3u');
    expect(read).toHaveBeenCalledWith('content://root/unknownSidecar');
    expect(read).toHaveBeenCalledWith('content://root/notes.xyz');
  });

  test('uses the shared audio-extension basis for SAF file detection', () => {
    for (const extension of AUDIO_EXTENSIONS) {
      const expectedSafFile = extension !== 'mp4';
      expect(mediaImport.isAudioFileUri(`content://root/shared-audio.${extension}`)).toBe(expectedSafFile);
      expect(mediaImport.shouldAttemptSafDirectoryRead(`content://root/shared-audio.${extension}`)).toBe(!expectedSafFile);
      expect(mediaImport.deriveMimeType(undefined, extension)?.startsWith('audio/')).toBe(true);
    }
  });

  test('continues to skip known non-audio sidecar extensions during SAF probing', () => {
    for (const extension of KNOWN_NON_AUDIO_EXTENSIONS) {
      expect(mediaImport.isAudioFileUri(`content://root/sidecar.${extension}`)).toBe(false);
      expect(mediaImport.shouldAttemptSafDirectoryRead(`content://root/sidecar.${extension}`)).toBe(false);
    }
  });

  test('recognizes audio file extensions case-insensitively and ignores query or fragment', () => {
    expect(mediaImport.deriveExtension('content://root/Music.Track.MP3?token=1#frag')).toBe('mp3');
    expect(mediaImport.isAudioFileUri('content://root/Music.Track.FLAC?token=1#frag')).toBe(true);
    expect(mediaImport.isAudioFileUri('content://root/cover.JPG?token=1')).toBe(false);
  });

  test('SAF directory-read heuristic skips known sidecar extensions only', () => {
    expect(mediaImport.shouldAttemptSafDirectoryRead('content://root/cover.jpg')).toBe(
      false,
    );
    expect(mediaImport.shouldAttemptSafDirectoryRead('content://root/list.m3u8')).toBe(
      false,
    );
    expect(mediaImport.shouldAttemptSafDirectoryRead('content://root/song.mp3')).toBe(
      false,
    );
    expect(mediaImport.shouldAttemptSafDirectoryRead('content://root/song.MP3?token=1')).toBe(
      false,
    );
    expect(mediaImport.shouldAttemptSafDirectoryRead('content://root/AC.DC')).toBe(true);
    expect(
      mediaImport.shouldAttemptSafDirectoryRead('content://root/unknown.entry'),
    ).toBe(true);
  });

  test('child read failure is ignored for unknown entries and keeps root audio files', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root')
        return ['content://root/song.mp3', 'content://root/unknown.entry'];
      throw new Error('random unknown failure');
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory(
      'content://root',
      read,
    );
    expect(result.files).toEqual(['content://root/song.mp3']);
    expect(result.errors).toEqual([]);
  });

  test('child dotted folder permission failure is reported', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/AC.DC'];
      throw new Error('permission denied');
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory(
      'content://root',
      read,
    );
    expect(result.errors).toEqual(['content://root/AC.DC']);
  });

  test('dedupes normalized SAF read errors from provider URI variants', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') {
        return [
          'content://root/No%20Access?token=1',
          'content://root/No%20Access?token=2',
          'content://root/Other%20Blocked',
        ];
      }
      throw new Error('permission denied');
    });

    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', read);

    expect(result.errors).toEqual([
      'content://root/No Access',
      'content://root/Other Blocked',
    ]);
  });

  test('child dotted folder security failure is reported', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/Vol.1'];
      throw new Error('SecurityException: SAF access denied');
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory(
      'content://root',
      read,
    );
    expect(result.errors).toEqual(['content://root/Vol.1']);
  });

  test('child unreadable location failure is reported', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/unreadable'];
      throw new Error("Location 'content://root/unreadable' isn't readable.");
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory(
      'content://root',
      read,
    );
    expect(result.errors).toEqual(['content://root/unreadable']);
  });

  test('child not-readable failure is reported', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/no-read'];
      throw new Error('not readable');
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory(
      'content://root',
      read,
    );
    expect(result.errors).toEqual(['content://root/no-read']);
  });

  test('root unknown read failure is always reported with normalized URI', async () => {
    const result = await mediaImport.readAudioUrisFromSafDirectory(
      'content://root/Music%20Folder?token=1',
      async () => {
        throw new Error('generic root failure');
      },
    );
    expect(result.errors).toEqual(['content://root/Music Folder']);
  });

  test('saf recursion respects depth limit and file cap', async () => {
    const deepRead = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/l1'];
      if (uri === 'content://root/l1') return ['content://root/l1/l2'];
      if (uri === 'content://root/l1/l2') return ['content://root/l1/l2/l3'];
      if (uri === 'content://root/l1/l2/l3') return ['content://root/l1/l2/l3/l4'];
      if (uri === 'content://root/l1/l2/l3/l4') return ['content://root/l1/l2/l3/l4/l5'];
      if (uri === 'content://root/l1/l2/l3/l4/l5') return ['content://root/l1/l2/l3/l4/l5/l6'];
      if (uri === 'content://root/l1/l2/l3/l4/l5/l6') return ['content://root/l1/l2/l3/l4/l5/l6/l7'];
      if (uri === 'content://root/l1/l2/l3/l4/l5/l6/l7') return ['content://root/l1/l2/l3/l4/l5/l6/l7/l8'];
      if (uri === 'content://root/l1/l2/l3/l4/l5/l6/l7/l8') return ['content://root/l1/l2/l3/l4/l5/l6/l7/l8/l9'];
      if (uri === 'content://root/l1/l2/l3/l4/l5/l6/l7/l8/l9') return ['content://root/l1/l2/l3/l4/l5/l6/l7/l8/l9/deep.mp3'];
      return [];
    });
    const depthResult = await mediaImport.readAudioUrisFromSafDirectory(
      'content://root',
      deepRead,
    );
    expect(depthResult.files).toEqual([]);

    const many = Array.from({ length: 6000 }, (_, idx) => `content://root/${idx}.mp3`);
    const capResult = await mediaImport.readAudioUrisFromSafDirectory(
      'content://root',
      async () => many,
    );
    expect(capResult.files.length).toBe(mediaImport.MAX_SAF_FILES);
  });

  test('saf recursion respects directory visit cap', async () => {
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') {
        return Array.from({ length: mediaImport.MAX_SAF_DIRECTORIES + 20 }, (_, idx) => `content://root/dir-${idx}`);
      }
      return [`${uri}/song.mp3`];
    });

    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', read);

    expect(read).toHaveBeenCalledTimes(mediaImport.MAX_SAF_DIRECTORIES);
    expect(read).not.toHaveBeenCalledWith(`content://root/dir-${mediaImport.MAX_SAF_DIRECTORIES - 1}`);
    expect(result.files.length).toBe(mediaImport.MAX_SAF_DIRECTORIES - 1);
  });

  test('saf scan imports audio files from the last allowed directory when directory cap is reached', async () => {
    const lastAllowedDirectory = `content://root/dir-${mediaImport.MAX_SAF_DIRECTORIES - 2}`;
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') {
        return Array.from({ length: mediaImport.MAX_SAF_DIRECTORIES + 20 }, (_, idx) => `content://root/dir-${idx}`);
      }
      if (uri === lastAllowedDirectory) return [`${uri}/last.mp3`, `${uri}/extra-subdir`];
      return [`${uri}/song.mp3`];
    });

    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', read);

    expect(result.files).toContain(`${lastAllowedDirectory}/last.mp3`);
    expect(read).not.toHaveBeenCalledWith(`${lastAllowedDirectory}/extra-subdir`);
    expect(read).toHaveBeenCalledTimes(mediaImport.MAX_SAF_DIRECTORIES);
  });

  test('saf scan progress reports directories files and errors', async () => {
    const progress = jest.fn();
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/song.mp3', 'content://root/no-read'];
      throw new Error('permission denied');
    });

    const result = await mediaImport.readAudioUrisFromSafDirectory('content://root', read, { onProgress: progress });

    expect(result.files).toEqual(['content://root/song.mp3']);
    expect(result.errors).toEqual(['content://root/no-read']);
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ directoriesVisited: 1, filesFound: 0, errorsFound: 0, currentUri: 'content://root' }));
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ directoriesVisited: 1, filesFound: 1, errorsFound: 0, currentUri: 'content://root/song.mp3' }));
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ directoriesVisited: 2, filesFound: 1, errorsFound: 1, currentUri: 'content://root/no-read' }));
  });

  test('readAudioUrisFromSafDirectory aborts before reading when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('scan aborted'));
    const read = jest.fn(async () => ['content://root/song.mp3']);

    await expect(
      mediaImport.readAudioUrisFromSafDirectory('content://root', read, {
        signal: controller.signal,
      }),
    ).rejects.toThrow('scan aborted');
    expect(read).not.toHaveBeenCalled();
  });

  test('readAudioUrisFromSafDirectory checks abort during recursive scans', async () => {
    const controller = new AbortController();
    const read = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/subdir'];
      controller.abort(new Error('recursive scan aborted'));
      return ['content://root/subdir/song.mp3'];
    });

    await expect(
      mediaImport.readAudioUrisFromSafDirectory('content://root', read, {
        signal: controller.signal,
      }),
    ).rejects.toThrow('recursive scan aborted');
    expect(read).toHaveBeenCalledWith('content://root/subdir');
  });

  test('readAudioUrisFromSafDirectory times out and skips a hanging child directory', async () => {
    const read = jest.fn((uri: string) => {
      if (uri === 'content://root') {
        return Promise.resolve(['content://root/song.mp3', 'content://root/hangs']);
      }
      return new Promise<string[]>(() => undefined);
    });

    const result = await mediaImport.readAudioUrisFromSafDirectory(
      'content://root',
      read,
      { readTimeoutMs: 1 },
    );

    expect(result.files).toEqual(['content://root/song.mp3']);
    expect(result.errors).toEqual(['content://root/hangs']);
  });

  test('readAudioUrisFromSafDirectory session-skips a previously timed-out child without another native read', async () => {
    const read = jest.fn((uri: string) => {
      if (uri === 'content://root') {
        return Promise.resolve(['content://root/hangs', 'content://root/hangs?token=retry']);
      }
      return new Promise<string[]>(() => undefined);
    });

    const result = await mediaImport.readAudioUrisFromSafDirectory(
      'content://root',
      read,
      { readTimeoutMs: 1 },
    );

    expect(result.files).toEqual([]);
    expect(result.errors).toEqual(['content://root/hangs']);
    expect(read).toHaveBeenCalledWith('content://root/hangs');
    expect(read).not.toHaveBeenCalledWith('content://root/hangs?token=retry');
  });

  test('scanFromSafFolders treats timeout as an unreadable folder and does not reread that URI in the same session', async () => {
    const read = StorageAccessFramework.readDirectoryAsync as jest.Mock;
    read.mockImplementation(() => new Promise<string[]>(() => undefined));

    const result = await mediaImport.scanFromSafFolders(
      [
        { id: 'f1', name: 'Music A', uri: 'content://timeout-root', addedAt: 1, enabled: true },
        { id: 'f2', name: 'Music B', uri: 'content://timeout-root', addedAt: 2, enabled: true },
      ] as any,
      { readTimeoutMs: 1 },
    );

    expect(result.songs).toEqual([]);
    expect(result.errors).toEqual(['content://timeout-root']);
    expect(result.folderUpdates?.map(folder => folder.lastError)).toEqual(['Nicht lesbar', 'Nicht lesbar']);
    expect(read).toHaveBeenCalledTimes(1);
  });

  test('readAudioUrisFromSafDirectory abort does not look like a native folder error', async () => {
    const controller = new AbortController();
    const read = jest.fn(() => {
      controller.abort(new Error('user stopped import'));
      return Promise.resolve(['content://root/song.mp3']);
    });

    await expect(
      mediaImport.readAudioUrisFromSafDirectory('content://root', read, {
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(mediaImport.SafDirectoryReadAbortedError);
  });

  test('readAudioUrisFromSafDirectory uses 4000ms timeout for a hanging child directory by default', async () => {
    const controller = new AbortController();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const read = jest.fn((uri: string) => {
      if (uri === 'content://root') return Promise.resolve(['content://root/hangs']);
      return new Promise<string[]>(() => undefined);
    });

    const resultPromise = mediaImport.readAudioUrisFromSafDirectory('content://root', read, {
      signal: controller.signal,
    });
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), mediaImport.DEFAULT_SAF_READ_DIRECTORY_TIMEOUT_MS);
    expect(setTimeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 10_000);
    controller.abort(new Error('stop default-timeout test'));
    await expect(resultPromise).rejects.toThrow('stop default-timeout test');
    setTimeoutSpy.mockRestore();
  });

  test('scanFromSafFolders abort signal stops SAF directory reads', async () => {
    const controller = new AbortController();
    const read = StorageAccessFramework.readDirectoryAsync as jest.Mock;
    read.mockImplementation(async () => {
      controller.abort(new Error('scan flow aborted'));
      return ['content://root/song.mp3'];
    });

    await expect(
      mediaImport.scanFromSafFolders(
        [{ id: 'f1', name: 'Root', uri: 'content://root', addedAt: 1, enabled: true }] as any,
        { signal: controller.signal },
      ),
    ).rejects.toThrow('scan flow aborted');
    expect(read).toHaveBeenCalledWith('content://root');
  });

  test('saf recursion uses visited set to avoid cycles', async () => {
    const cyclicRead = jest.fn(async (uri: string) => {
      if (uri === 'content://root') return ['content://root/loop'];
      if (uri === 'content://root/loop') return ['content://root'];
      return [];
    });
    const result = await mediaImport.readAudioUrisFromSafDirectory(
      'content://root',
      cyclicRead,
    );
    expect(result.errors).toEqual([]);
    expect(cyclicRead).toHaveBeenCalledTimes(2);
  });

  test('scanFromSafFolders sets partial error for child permission failures and keeps songs', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockImplementation(
      async (uri: string) => {
        if (uri === 'content://root')
          return ['content://root/song.mp3', 'content://root/unknown.entry'];
        throw new Error('permission denied');
      },
    );
    const result = await mediaImport.scanFromSafFolders([
      { id: 'f1', name: 'Root', uri: 'content://root', addedAt: 1, enabled: true },
    ] as any);
    expect(result.songs.length).toBe(1);
    expect(result.errors).toEqual(['content://root/unknown.entry']);
    expect(result.folderUpdates?.[0].lastError).toBe('Teilweise nicht lesbar');
  });

  test('scanFromSafFolders sets partial error for child readability failures and keeps songs', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockImplementation(
      async (uri: string) => {
        if (uri === 'content://root')
          return ['content://root/song.mp3', 'content://root/subdir'];
        throw new Error("Location 'content://root/subdir' isn't readable.");
      },
    );
    const result = await mediaImport.scanFromSafFolders([
      { id: 'f1', name: 'Root', uri: 'content://root', addedAt: 1, enabled: true },
    ] as any);
    expect(result.songs.length).toBe(1);
    expect(result.errors).toEqual(['content://root/subdir']);
    expect(result.folderUpdates?.[0].lastError).toBe('Teilweise nicht lesbar');
  });

  test('scanFromSafFolders ignores child ENOTDIR errors for lastError', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockImplementation(
      async (uri: string) => {
        if (uri === 'content://root')
          return ['content://root/song.mp3', 'content://root/subdir'];
        if (uri === 'content://root/subdir') throw new Error('ENOTDIR');
        return [];
      },
    );
    const result = await mediaImport.scanFromSafFolders([
      { id: 'f1', name: 'Root', uri: 'content://root', addedAt: 1, enabled: true },
    ] as any);
    expect(result.songs.length).toBe(1);
    expect(result.errors).toEqual([]);
    expect(result.folderUpdates?.[0].lastError).toBeUndefined();
  });

  test('scanFromSafFolders ignores unknown child errors for lastError', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockImplementation(
      async (uri: string) => {
        if (uri === 'content://root')
          return ['content://root/song.mp3', 'content://root/subdir'];
        if (uri === 'content://root/subdir') throw new Error('generic failure');
        return [];
      },
    );
    const result = await mediaImport.scanFromSafFolders([
      { id: 'f1', name: 'Root', uri: 'content://root', addedAt: 1, enabled: true },
    ] as any);
    expect(result.songs.length).toBe(1);
    expect(result.errors).toEqual([]);
    expect(result.folderUpdates?.[0].lastError).toBeUndefined();
  });

  test('saf fast import uses filename fallback when ID3 is disabled', async () => {
    (parseId3FromUri as jest.Mock).mockClear();
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValueOnce([
      'content://dir/The%20Artist%20-%20Title.mp3',
    ]);
    const result = await mediaImport.scanFromSafFolders(
      [{ id: 'f1', name: 'Music', uri: 'content://dir', addedAt: 1, enabled: true }] as any,
      { readId3Tags: false },
    );
    expect(result.songs[0].title).toBe('Title');
    expect(result.songs[0].artist).toBe('The Artist');
    expect(result.songs[0].coverInfo?.status).toBe('none');
    expect(parseId3FromUri).not.toHaveBeenCalled();
    expect(cacheBase64Cover).toHaveBeenCalledWith(
      'content://dir/The%20Artist%20-%20Title.mp3',
      undefined,
    );
  });

  test('scanFromSafFolders enriches SAF songs with native audio info', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValueOnce(['content://dir/song.mp3']);
    (SystemAudio.extractAudioInfo as jest.Mock).mockResolvedValueOnce({
      durationMs: 245000,
      sizeBytes: 9_800_000,
      bitrateBps: 320000,
      sampleRateHz: 44100,
      channels: 2,
      mimeType: 'audio/mpeg',
      displayName: 'Native Song.mp3',
    });

    const result = await mediaImport.scanFromSafFolders([
      { id: 'f1', name: 'Music', uri: 'content://dir', addedAt: 1, enabled: true },
    ] as any, { loadNativeCover: false });

    expect(SystemAudio.extractAudioInfo).toHaveBeenCalledWith('content://dir/song.mp3');
    expect(result.songs[0]).toMatchObject({
      duration: 245000,
      fileInfo: { filename: 'Native Song.mp3', size: 9_800_000, mimeType: 'audio/mpeg' },
      audioInfo: { bitrate: 320, sampleRate: 44100, channels: 2, codec: 'audio/mpeg' },
    });
  });

  test('native bitrate wins over size and duration estimate', async () => {
    const song = await mediaImport.buildSongFromImportSource({
      id: 'x',
      uri: 'content://x.mp3',
      source: 'saf',
      durationMs: 100000,
      size: 1_000_000,
      bitrateBps: 128000,
    } as any, {}, { loadNativeCover: false });

    expect(song.audioInfo?.bitrate).toBe(128);
  });

  test('falls back to estimated bitrate when native bitrate is missing', async () => {
    const song = await mediaImport.buildSongFromImportSource({
      id: 'x',
      uri: 'content://x.mp3',
      source: 'saf',
      durationMs: 100000,
      size: 1_000_000,
    } as any, {}, { loadNativeCover: false });

    expect(song.audioInfo?.bitrate).toBe(80);
  });

  test('extractAudioInfo failures do not abort SAF import', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValueOnce(['content://dir/bad.mp3']);
    (SystemAudio.extractAudioInfo as jest.Mock).mockRejectedValueOnce(new Error('provider failed'));

    const result = await mediaImport.scanFromSafFolders([
      { id: 'f1', name: 'Music', uri: 'content://dir', addedAt: 1, enabled: true },
    ] as any, { loadNativeCover: false });

    expect(result.songs).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  test('saf import collects root folder errors', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockRejectedValueOnce(
      new Error('no access'),
    );
    const result = await mediaImport.scanFromSafFolders([
      { id: 'f1', name: 'Music', uri: 'content://dir', addedAt: 1, enabled: true },
    ] as any);
    expect(result.errors.length).toBe(1);
    expect(result.folderUpdates?.[0].lastError).toBe('Nicht lesbar');
  });
});

test('buildSongFromImportSource maps track/disc/comment fields', async () => {
  const song = await mediaImport.buildSongFromImportSource(
    { id: 'x', uri: 'file:///x.mp3', source: 'saf' } as any,
    {
      trackNumber: '4/10',
      discNumber: '1/2',
      comment: 'Note',
    } as any,
  );
  expect(song.trackNumber).toBe('4/10');
  expect(song.discNumber).toBe('1/2');
  expect(song.comment).toBe('Note');
});
test('buildSongFromImportSource sets albumArtist from ID3 tags', async () => {
  const song = await mediaImport.buildSongFromImportSource(
    { id: 'album-artist', uri: 'file:///album-artist.mp3', source: 'saf' } as any,
    { title: 'Song', artist: 'Track Artist', albumArtist: 'Various Artists' } as any,
  );
  expect(song.albumArtist).toBe('Various Artists');
});
