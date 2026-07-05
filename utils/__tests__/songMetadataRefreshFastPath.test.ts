import { refreshSongsFromId3, mergeFastMetadataIntoId3Tags } from '../songMetadataRefresh';
import type { Song } from '../../types/Song';
import * as id3Parser from '../id3Parser';

jest.mock('../../modules/expo-system-audio', () => ({
  __esModule: true,
  default: { extractMetadataFast: jest.fn().mockResolvedValue(null) },
}));

const song = (id: string, patch: Partial<Song> = {}): Song => ({
  id,
  title: id,
  artist: 'Artist',
  uri: `file:///${id}.mp3`,
  ...patch,
});

beforeEach(() => {
  jest.restoreAllMocks();
});

test('mergeFastMetadataIntoId3Tags lets native fields win over id3 tags', () => {
  const merged = mergeFastMetadataIntoId3Tags(
    { title: 'Native', artist: 'Native Artist' },
    { title: 'Slow ID3', album: 'Album' },
  );
  expect(merged.title).toBe('Native');
  expect(merged.artist).toBe('Native Artist');
  expect(merged.album).toBe('Album');
});

test('mergeFastMetadataIntoId3Tags keeps id3 fields when native is missing/blank', () => {
  const merged = mergeFastMetadataIntoId3Tags(
    { title: '   ' },
    { title: 'Fallback', artist: 'Fallback Artist' },
  );
  expect(merged.title).toBe('Fallback');
  expect(merged.artist).toBe('Fallback Artist');
});

test('mergeFastMetadataIntoId3Tags ignores native placeholder strings before overriding parsed tags', () => {
  const parsedTags = {
    title: 'Tail Title',
    artist: 'Tail Artist',
    album: 'Tail Album',
  };

  expect(mergeFastMetadataIntoId3Tags({ title: 'unknown' }, parsedTags).title).toBe('Tail Title');
  expect(mergeFastMetadataIntoId3Tags({ title: 'undefined' }, parsedTags).title).toBe('Tail Title');
  expect(mergeFastMetadataIntoId3Tags({ title: '<unknown>' }, parsedTags).title).toBe('Tail Title');
  expect(mergeFastMetadataIntoId3Tags({ artist: 'unknown' }, parsedTags).artist).toBe('Tail Artist');
  expect(mergeFastMetadataIntoId3Tags({ album: 'null' }, parsedTags).album).toBe('Tail Album');
});


test('refreshSongsFromId3 uses extractMetadataFast first and skips full ID3 fields it provides', async () => {
  const parseSpy = jest.spyOn(id3Parser, 'parseId3FromUri').mockResolvedValue({ album: 'JS Album' });
  const extractMetadataFast = jest.fn().mockResolvedValue({ title: 'Fast Title', artist: 'Fast Artist' });

  const result = await refreshSongsFromId3([song('a')], {
    perTrackTimeoutMs: 0,
    extractMetadataFast,
  });

  expect(extractMetadataFast).toHaveBeenCalledWith('file:///a.mp3');
  expect(result.updated).toBe(1);
  expect(result.songs[0].title).toBe('Fast Title');
  expect(result.songs[0].artist).toBe('Fast Artist');
  expect(result.songs[0].album).toBe('JS Album');
  parseSpy.mockRestore();
});

test('refreshSongsFromId3 records error details for failed files', async () => {
  const parseSpy = jest.spyOn(id3Parser, 'parseId3FromUri').mockRejectedValue(new Error('corrupt header'));

  const result = await refreshSongsFromId3([song('b')], {
    perTrackTimeoutMs: 0,
    disableNativeFastPath: true,
  });

  expect(result.failed).toBe(1);
  expect(result.errorDetails).toEqual([{ uri: 'file:///b.mp3', reason: 'corrupt header' }]);
  parseSpy.mockRestore();
});

test('refreshSongsFromId3 falls back to ID3 when native fast-path throws', async () => {
  const parseSpy = jest.spyOn(id3Parser, 'parseId3FromUri').mockResolvedValue({ title: 'ID3 Only' });
  const extractMetadataFast = jest.fn().mockRejectedValue(new Error('native unavailable'));

  const result = await refreshSongsFromId3([song('c')], {
    perTrackTimeoutMs: 0,
    extractMetadataFast,
  });

  expect(result.updated).toBe(1);
  expect(result.songs[0].title).toBe('ID3 Only');
  parseSpy.mockRestore();
});
