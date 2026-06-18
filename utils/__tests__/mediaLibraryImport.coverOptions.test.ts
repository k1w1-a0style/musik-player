import SystemAudio from 'expo-system-audio';
import { buildSongFromImportSource, enrichMediaLibraryAssets } from '../mediaLibraryImport';

jest.mock('../coverCache', () => ({
  cacheBase64Cover: jest.fn(async () => undefined),
  isBase64ImageDataUri: jest.fn(() => false),
}));

jest.mock('../id3Parser', () => ({
  parseId3FromUri: jest.fn(async () => ({})),
}));

beforeEach(() => {
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockReset();
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue(null);
});

test('buildSongFromImportSource can skip native cover loading', async () => {
  const song = await buildSongFromImportSource(
    {
      id: 's1',
      uri: 'song.mp3',
      filename: 'Song.mp3',
      source: 'media-library',
    },
    {},
    { loadNativeCover: false },
  );

  expect(SystemAudio.extractEmbeddedArtwork).not.toHaveBeenCalled();
  expect(song.cover).toBeUndefined();
  expect(song.coverInfo).toEqual({ status: 'none', uri: undefined, embeddedArtworkChecked: false });
});

test('enrichMediaLibraryAssets loads native covers by default', async () => {
  (SystemAudio.extractEmbeddedArtwork as jest.Mock).mockResolvedValue({ uri: 'file:///cover.jpg' });

  const result = await enrichMediaLibraryAssets([
    {
      id: 's1',
      uri: 'song.mp3',
      filename: 'Song.mp3',
      duration: 1,
    } as any,
  ]);

  expect(SystemAudio.extractEmbeddedArtwork).toHaveBeenCalledWith('song.mp3');
  expect(result.songs).toHaveLength(1);
  expect(result.songs[0].cover).toBe('file:///cover.jpg');
  expect(result.songs[0].coverInfo?.status).toBe('cached');
});

test('enrichMediaLibraryAssets can explicitly skip native covers', async () => {
  const result = await enrichMediaLibraryAssets(
    [
      {
        id: 's1',
        uri: 'song.mp3',
        filename: 'Song.mp3',
        duration: 1,
      } as any,
    ],
    0,
    { loadNativeCover: false },
  );

  expect(SystemAudio.extractEmbeddedArtwork).not.toHaveBeenCalled();
  expect(result.songs).toHaveLength(1);
  expect(result.songs[0].cover).toBeUndefined();
  expect(result.songs[0].coverInfo).toEqual({ status: 'none', uri: undefined, embeddedArtworkChecked: false });
});
