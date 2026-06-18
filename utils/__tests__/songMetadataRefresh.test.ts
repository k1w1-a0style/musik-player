import { parseId3FromUri } from '../id3Parser';
import {
  applyId3TagsToSong,
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
    album: 'New Album',
    year: ' 2024 ',
    genre: 'Techno',
    trackNumber: ' 1/10 ',
    discNumber: ' 1/1 ',
    comment: ' Nice ',
  })).toEqual({
    ...baseSong,
    title: 'New Title',
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

  expect(parseId3FromUri).toHaveBeenCalledWith('file:///song.mp3', expect.objectContaining({ includeCover: false, maxHeadBytes: 256 * 1024, maxTailBytes: 0, maxFrameScanBytes: 512 * 1024 }));
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
