import { parseId3FromUri } from '../id3Parser';
import {
  applyId3TagsToSong,
  buildId3SongPatch,
  normalizeCoverReferenceForComparison,
  refreshSongsFromId3,
  resolveMetadataRefreshUri,
} from '../songMetadataRefresh';
import type { Song } from '../../types/Song';

jest.mock('../id3Parser', () => ({
  parseId3FromUri: jest.fn(async () => ({})),
}));

const baseSong: Song = {
  id: 's1',
  title: 'Old Title',
  artist: 'Old Artist',
  album: 'Old Album',
  uri: 'file:///song.mp3',
};

beforeEach(() => {
  (parseId3FromUri as jest.Mock).mockReset();
});

test('resolves metadata refresh uri with trimmed primary and fileInfo fallback', () => {
  expect(resolveMetadataRefreshUri({ ...baseSong, uri: ' file:///trimmed.mp3 ' })).toBe('file:///trimmed.mp3');
  expect(resolveMetadataRefreshUri({ ...baseSong, uri: '   ', fileInfo: { uri: ' file:///fallback.mp3 ' } })).toBe('file:///fallback.mp3');
  expect(resolveMetadataRefreshUri({ ...baseSong, uri: undefined, fileInfo: { uri: 'file:///fallback.mp3' } })).toBe('file:///fallback.mp3');
  expect(resolveMetadataRefreshUri({ ...baseSong, uri: '   ', fileInfo: { uri: '   ' } })).toBeUndefined();
});

test('applies trimmed ID3 text fields without overwriting with blanks', () => {
  expect(applyId3TagsToSong(baseSong, {
    title: ' New Title ',
    artist: '   ',
    albumArtist: ' Album Artist ',
    album: 'New Album',
    year: ' 2024 ',
    genre: 'Techno',
    trackNumber: ' 1/10 ',
    discNumber: ' 1/1 ',
    comment: ' Nice ',
  })).toEqual({
    ...baseSong,
    title: 'New Title',
    albumArtist: 'Album Artist',
    album: 'New Album',
    year: '2024',
    genre: 'Techno',
    trackNumber: '1/10',
    discNumber: '1/1',
    comment: 'Nice',
  });
});

test('updates changed text metadata from ID3 tags', async () => {
  (parseId3FromUri as jest.Mock).mockResolvedValue({
    title: ' New Title ',
    artist: 'New Artist',
    album: 'New Album',
    year: '2024',
    genre: 'Techno',
    trackNumber: '1/10',
    discNumber: '1/1',
    comment: 'Nice',
  });

  const result = await refreshSongsFromId3([baseSong]);

  expect(parseId3FromUri).toHaveBeenCalledWith('file:///song.mp3', expect.objectContaining({ includeCover: false, maxHeadBytes: 256 * 1024, maxTailBytes: 0, maxFrameOffsetBytes: 8 * 1024 * 1024, maxFrameBodyReadBytes: 512 * 1024 }));
  expect(result.updated).toBe(1);
  expect(result.skipped).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.songs[0]).toEqual({
    ...baseSong,
    title: 'New Title',
    artist: 'New Artist',
    album: 'New Album',
    year: '2024',
    genre: 'Techno',
    trackNumber: '1/10',
    discNumber: '1/1',
    comment: 'Nice',
  });
  expect(result.patchesBySongId).toEqual({
    s1: {
      title: 'New Title',
      artist: 'New Artist',
      album: 'New Album',
      year: '2024',
      genre: 'Techno',
      trackNumber: '1/10',
      discNumber: '1/1',
      comment: 'Nice',
    },
  });
});

test('updates embedded cover and coverInfo together when ID3 cover changes', async () => {
  const oldCover = 'data:image/jpeg;base64,old-cover';
  const newCover = 'data:image/jpeg;base64,new-cover';
  const songWithCover: Song = {
    ...baseSong,
    cover: oldCover,
    coverInfo: { status: 'embedded', uri: oldCover },
  };
  (parseId3FromUri as jest.Mock).mockResolvedValue({ title: 'New Title', cover: ` ${newCover} ` });

  const result = await refreshSongsFromId3([songWithCover]);

  expect(result.updated).toBe(1);
  expect(result.songs[0]).toEqual({
    ...songWithCover,
    title: 'New Title',
    cover: newCover,
    coverInfo: { status: 'embedded', uri: newCover, embeddedArtworkChecked: true },
  });
});


test('does not update cover when parsed cover matches normalized stored uri', () => {
  const storedCover = 'file:///covers/Album%20Art.jpg?mtime=1#image';
  const parsedCover = 'file:///covers/Album Art.jpg';
  const songWithEquivalentCover: Song = {
    ...baseSong,
    cover: storedCover,
    coverInfo: { status: 'embedded', uri: storedCover },
  };

  expect(normalizeCoverReferenceForComparison(storedCover)).toBe(parsedCover);
  expect(applyId3TagsToSong(songWithEquivalentCover, { cover: ` ${parsedCover} ` })).toBe(songWithEquivalentCover);
});


test('updates cover when both normalized references keep different query identity', () => {
  const songWithVersionedCover: Song = {
    ...baseSong,
    cover: 'file:///covers/Album%20Art.jpg?version=1',
    coverInfo: { status: 'embedded', uri: 'file:///covers/Album%20Art.jpg?version=1' },
  };

  expect(applyId3TagsToSong(songWithVersionedCover, { cover: 'file:///covers/Album%20Art.jpg?version=2' })).toEqual({
    ...songWithVersionedCover,
    cover: 'file:///covers/Album%20Art.jpg?version=2',
    coverInfo: { status: 'embedded', uri: 'file:///covers/Album%20Art.jpg?version=2', embeddedArtworkChecked: true },
  });
});

test('repairs stale coverInfo when parsed embedded cover matches existing cover', () => {
  const cover = 'data:image/png;base64,cover';
  const songWithStaleCoverInfo: Song = {
    ...baseSong,
    cover,
    coverInfo: { status: 'cached', uri: 'file:///old-cache.png' },
  };

  expect(applyId3TagsToSong(songWithStaleCoverInfo, { cover })).toEqual({
    ...songWithStaleCoverInfo,
    coverInfo: { status: 'embedded', uri: cover, embeddedArtworkChecked: true },
  });
});

test('allows later ID3 cover refresh to replace a persisted no-cover backfill state', () => {
  const cover = 'file:///covers/fresh-cover.jpg';
  const songWithoutEmbeddedCover: Song = {
    ...baseSong,
    coverInfo: { status: 'none', embeddedArtworkChecked: true },
  };

  expect(applyId3TagsToSong(songWithoutEmbeddedCover, { cover })).toEqual({
    ...songWithoutEmbeddedCover,
    cover,
    coverInfo: { status: 'embedded', uri: cover, embeddedArtworkChecked: true },
  });
});

test('keeps existing cover when ID3 refresh returns no cover', async () => {
  const songWithCover: Song = {
    ...baseSong,
    cover: 'file:///existing-cover.jpg',
    coverInfo: { status: 'cached', uri: 'file:///existing-cover.jpg' },
  };
  (parseId3FromUri as jest.Mock).mockResolvedValue({ title: 'New Title' });

  const result = await refreshSongsFromId3([songWithCover]);

  expect(result.songs[0]).toEqual({
    ...songWithCover,
    title: 'New Title',
  });
});

test('does not count unchanged normalized tags as updates', async () => {
  (parseId3FromUri as jest.Mock).mockResolvedValue({
    title: ' Old Title ',
    artist: 'Old Artist',
    album: 'Old Album',
  });

  const result = await refreshSongsFromId3([baseSong]);

  expect(result.updated).toBe(0);
  expect(result.songs[0]).toBe(baseSong);
});

test('uses fileInfo fallback when primary uri is blank', async () => {
  (parseId3FromUri as jest.Mock).mockResolvedValue({ title: 'Fallback Title' });
  const songWithFallback: Song = {
    ...baseSong,
    uri: '   ',
    fileInfo: { uri: ' file:///fallback.mp3 ' },
  };

  const result = await refreshSongsFromId3([songWithFallback]);

  expect(parseId3FromUri).toHaveBeenCalledWith('file:///fallback.mp3', expect.objectContaining({ includeCover: false }));
  expect(result.updated).toBe(1);
  expect(result.skipped).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.songs[0].title).toBe('Fallback Title');
});

test('skips songs without a usable URI', async () => {
  const songWithoutUri: Song = { id: 's2', title: 'No URI', artist: 'Unknown', uri: '   ', fileInfo: { uri: '   ' } };

  const result = await refreshSongsFromId3([songWithoutUri]);

  expect(parseId3FromUri).not.toHaveBeenCalled();
  expect(result.updated).toBe(0);
  expect(result.skipped).toBe(1);
  expect(result.failed).toBe(0);
  expect(result.songs[0]).toBe(songWithoutUri);
});

test('keeps original song and records failure when ID3 read fails', async () => {
  (parseId3FromUri as jest.Mock).mockRejectedValue(new Error('bad file'));

  const result = await refreshSongsFromId3([baseSong]);

  expect(result.updated).toBe(0);
  expect(result.skipped).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.errors).toEqual(['file:///song.mp3']);
  expect(result.songs[0]).toBe(baseSong);
});

test('keeps output order stable with parallel refresh', async () => {
  const songs: Song[] = [
    { ...baseSong, id: 's1', title: 'one', uri: 'file:///1.mp3' },
    { ...baseSong, id: 's2', title: 'two', uri: 'file:///2.mp3' },
    { ...baseSong, id: 's3', title: 'three', uri: 'file:///3.mp3' },
  ];
  (parseId3FromUri as jest.Mock).mockImplementation(async (uri: string) => {
    if (uri.endsWith('1.mp3')) await new Promise(resolve => setTimeout(resolve, 25));
    if (uri.endsWith('2.mp3')) await new Promise(resolve => setTimeout(resolve, 5));
    return { title: `new-${uri.slice(-5, -4)}` };
  });

  const result = await refreshSongsFromId3(songs, { concurrency: 3 });

  expect(result.songs.map(song => song.id)).toEqual(['s1', 's2', 's3']);
  expect(result.songs.map(song => song.title)).toEqual(['new-1', 'new-2', 'new-3']);
});

test('respects concurrency limit and continues processing after failures/skips', async () => {
  const songs: Song[] = [
    { ...baseSong, id: 's1', uri: 'file:///1.mp3' },
    { ...baseSong, id: 's2', uri: '   ', fileInfo: { uri: '   ' } },
    { ...baseSong, id: 's3', uri: 'file:///3.mp3' },
    { ...baseSong, id: 's4', uri: 'file:///4.mp3' },
    { ...baseSong, id: 's5', uri: 'file:///5.mp3' },
  ];
  let inFlight = 0;
  let maxInFlight = 0;
  (parseId3FromUri as jest.Mock).mockImplementation(async (uri: string) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise(resolve => setTimeout(resolve, 10));
    inFlight -= 1;
    if (uri.endsWith('4.mp3')) throw new Error('bad');
    if (uri.endsWith('5.mp3')) return { title: 'Old Title' };
    return { title: `updated-${uri.slice(-5, -4)}` };
  });

  const result = await refreshSongsFromId3(songs, { concurrency: 2 });

  expect(maxInFlight).toBeLessThanOrEqual(2);
  expect(parseId3FromUri).toHaveBeenCalledTimes(4);
  expect(parseId3FromUri).not.toHaveBeenCalledWith('   ');
  expect(result.updated).toBe(2);
  expect(result.skipped).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.errors).toEqual(['file:///4.mp3']);
  expect(result.songs.map(song => song.id)).toEqual(['s1', 's2', 's3', 's4', 's5']);
  expect(result.songs[1]).toBe(songs[1]);
  expect(result.songs[3]).toBe(songs[3]);
});

test('concurrency 1 behaves sequentially and invalid options clamp to sequential execution', async () => {
  const songs: Song[] = [
    { ...baseSong, id: 's1', uri: 'file:///1.mp3' },
    { ...baseSong, id: 's2', uri: 'file:///2.mp3' },
    { ...baseSong, id: 's3', uri: 'file:///3.mp3' },
  ];
  const seen: string[] = [];
  (parseId3FromUri as jest.Mock).mockImplementation(async (uri: string) => {
    seen.push(uri);
    return { title: `${uri}-ok` };
  });

  await refreshSongsFromId3(songs, { concurrency: 1 });
  expect(seen).toEqual(['file:///1.mp3', 'file:///2.mp3', 'file:///3.mp3']);

  seen.length = 0;
  await refreshSongsFromId3(songs, { concurrency: 0 });
  expect(seen).toEqual(['file:///1.mp3', 'file:///2.mp3', 'file:///3.mp3']);

  seen.length = 0;
  await refreshSongsFromId3(songs, { concurrency: Number.NaN });
  expect(seen.length).toBe(3);
});

test('exposes processed partial results when abort happens after progress', async () => {
  const controller = new AbortController();
  const songs: Song[] = [
    { ...baseSong, id: 's1', uri: 'file:///1.mp3' },
    { ...baseSong, id: 's2', uri: 'file:///2.mp3' },
  ];
  (parseId3FromUri as jest.Mock).mockImplementation(async (uri: string) => {
    if (uri.endsWith('1.mp3')) return { title: 'Fresh 1' };
    return { title: 'Fresh 2' };
  });

  await expect(refreshSongsFromId3(songs, {
    signal: controller.signal,
    onProgress: () => controller.abort(new Error('stop')),
    concurrency: 1,
  })).rejects.toMatchObject({
    name: 'MetadataRefreshPartialError',
    result: expect.objectContaining({
      updated: 1,
      processed: 1,
      total: 2,
      completed: false,
      aborted: true,
      patchesBySongId: { s1: { title: 'Fresh 1' } },
      lastProcessedSongId: 's1',
    }),
  });
});

test('notifies per-song partial progress for updated skipped and failed songs', async () => {
  const withoutUri: Song = { ...baseSong, id: 's2', uri: '   ', fileInfo: { uri: '   ' } };
  const failing: Song = { ...baseSong, id: 's3', uri: 'file:///bad.mp3' };
  (parseId3FromUri as jest.Mock).mockImplementation(async (uri: string) => {
    if (uri.endsWith('bad.mp3')) throw new Error('bad');
    return { title: 'Fresh callback' };
  });
  const onSongProcessed = jest.fn();

  await refreshSongsFromId3([baseSong, withoutUri, failing], { onSongProcessed, concurrency: 1 });

  expect(onSongProcessed).toHaveBeenNthCalledWith(1, expect.objectContaining({
    index: 0,
    patch: { title: 'Fresh callback' },
    updatedDelta: 1,
    skippedDelta: 0,
    failedDelta: 0,
  }));
  expect(onSongProcessed).toHaveBeenNthCalledWith(2, expect.objectContaining({
    index: 1,
    song: withoutUri,
    updatedDelta: 0,
    skippedDelta: 1,
    failedDelta: 0,
  }));
  expect(onSongProcessed).toHaveBeenNthCalledWith(3, expect.objectContaining({
    index: 2,
    song: failing,
    updatedDelta: 0,
    skippedDelta: 0,
    failedDelta: 1,
    errorUri: 'file:///bad.mp3',
  }));
});

test('manual metadata refresh parser options keep cover parsing disabled', async () => {
  (parseId3FromUri as jest.Mock).mockResolvedValue({ title: 'No Cover Parse' });

  await refreshSongsFromId3([baseSong]);

  expect(parseId3FromUri).toHaveBeenCalledWith('file:///song.mp3', expect.objectContaining({ includeCover: false }));
});

test('buildId3SongPatch includes albumArtist and ignores blank incoming albumArtist', () => {
  expect(buildId3SongPatch(baseSong, { albumArtist: ' Various Artists ' })).toEqual({ albumArtist: 'Various Artists' });
  expect(buildId3SongPatch({ ...baseSong, albumArtist: 'Existing' }, { albumArtist: '   ' })).toEqual({});
});

test('isolates a stuck track with a per-track timeout and completes the rest', async () => {
  const songs: Song[] = [
    { ...baseSong, id: 's1', uri: 'file:///fast1.mp3' },
    { ...baseSong, id: 's2', uri: 'file:///stuck.mp3' },
    { ...baseSong, id: 's3', uri: 'file:///fast3.mp3' },
  ];
  (parseId3FromUri as jest.Mock).mockImplementation((uri: string) => {
    if (uri.includes('stuck')) {
      // Never settles; the per-track timeout must win and mark this track failed.
      return new Promise(() => undefined);
    }
    return Promise.resolve({ title: `Fresh ${uri}` });
  });

  const result = await refreshSongsFromId3(songs, { concurrency: 1, perTrackTimeoutMs: 20 });

  expect(result.completed).toBe(true);
  expect(result.processed).toBe(3);
  expect(result.updated).toBe(2);
  expect(result.failed).toBe(1);
  expect(result.skipped).toBe(0);
  expect(result.errors).toEqual(['file:///stuck.mp3']);
  expect(result.errorDetails).toEqual([{ uri: 'file:///stuck.mp3', reason: 'timeout' }]);
  expect(result.songs.map(refreshedSong => refreshedSong.id)).toEqual(['s1', 's2', 's3']);
  expect(result.songs[1]).toBe(songs[1]);
});

test('records the concrete error reason when a track read throws', async () => {
  (parseId3FromUri as jest.Mock).mockRejectedValue(new Error('corrupt header'));

  const result = await refreshSongsFromId3([baseSong], { perTrackTimeoutMs: 0 });

  expect(result.failed).toBe(1);
  expect(result.errors).toEqual(['file:///song.mp3']);
  expect(result.errorDetails).toEqual([{ uri: 'file:///song.mp3', reason: 'corrupt header' }]);
});
