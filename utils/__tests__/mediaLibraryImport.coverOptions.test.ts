import { buildSongFromImportSource, enrichMediaLibraryAssets } from '../mediaLibraryImport';

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

  expect(song.cover).toBeUndefined();
  expect(song.coverInfo).toEqual({ status: 'none', uri: undefined });
});

test('enrichMediaLibraryAssets skips native covers by default', async () => {
  const result = await enrichMediaLibraryAssets([
    {
      id: 's1',
      uri: 'song.mp3',
      filename: 'Song.mp3',
      duration: 1,
    } as any,
  ]);

  expect(result.songs).toHaveLength(1);
  expect(result.songs[0].cover).toBeUndefined();
  expect(result.songs[0].coverInfo?.status).toBe('none');
});
