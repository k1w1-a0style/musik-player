import { parseId3FromUri } from '../id3Parser';
import { refreshSongsFromId3 } from '../songMetadataRefresh';
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

  expect(parseId3FromUri).toHaveBeenCalledWith('file:///song.mp3');
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

test('skips songs without a URI', async () => {
  const songWithoutUri: Song = { id: 's2', title: 'No URI', artist: 'Unknown' };

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
