import { StorageAccessFramework } from 'expo-file-system/legacy';
import { cacheBase64Cover } from '../coverCache';
import { parseId3FromUri } from '../id3Parser';
import * as mediaImport from '../mediaLibraryImport';

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
  test('SAF directory timeout defaults to 2000ms', () => {
    expect(mediaImport.DEFAULT_SAF_READ_DIRECTORY_TIMEOUT_MS).toBe(2000);
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

  test('loads all pages', async () => {
    const getAssetsPage = jest.fn(async ({ after }: { after?: string }) =>
      !after
        ? { assets: [{ id: '1' }, { id: '2' }], hasNextPage: true, endCursor: 'a' }
        : { assets: [{ id: '3' }], hasNextPage: false, endCursor: 'b' },
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
      if (uri === 'content://root/l1/l2/l3') return ['content://root/l1/l2/l3/deep.mp3'];
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

  test('readAudioUrisFromSafDirectory uses 2000ms timeout for a hanging child directory by default', async () => {
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