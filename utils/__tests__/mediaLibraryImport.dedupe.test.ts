import { StorageAccessFramework } from 'expo-file-system/legacy';
import {
  enrichMediaLibraryAssets,
  normalizeImportUriForDedupe,
  readAudioUrisFromSafDirectory,
  scanAudioAssetsFromMediaLibrary,
  scanFromSafFolders,
} from '../mediaLibraryImport';

jest.mock('expo-file-system/legacy', () => ({
  StorageAccessFramework: { readDirectoryAsync: jest.fn(async () => []) },
}));

jest.mock('../id3Parser', () => ({
  parseId3FromUri: jest.fn(async () => ({})),
}));

jest.mock('../coverCache', () => ({
  cacheBase64Cover: jest.fn(async () => undefined),
  isBase64ImageDataUri: jest.fn(() => false),
}));

jest.mock('expo-system-audio', () => ({
  __esModule: true,
  default: { extractEmbeddedArtwork: jest.fn(async () => null) },
}));

const mediaAsset = (id: string, uri: string, filename = 'song.mp3') => ({
  id,
  uri,
  filename,
  duration: 180,
});

const safUri = (path: string): string => `saf://root/${encodeURIComponent(path)}`;

describe('mediaLibraryImport dedupe', () => {
  beforeEach(() => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockReset();
  });

  test('normalizes import URIs for stable dedupe keys', () => {
    expect(normalizeImportUriForDedupe('file:///Music/My%20Song.mp3?token=1#frag')).toBe('file:///Music/My Song.mp3');
    expect(normalizeImportUriForDedupe('saf://root/Music%2FSong.mp3/')).toBe('saf://root/Music/Song.mp3');
    expect(normalizeImportUriForDedupe('file:///Music\\Song.mp3')).toBe('file:///Music/Song.mp3');
  });

  test('scanAudioAssetsFromMediaLibrary skips duplicate normalized URIs even with different asset ids', async () => {
    const getAssetsPage = jest.fn(async () => ({
      assets: [
        mediaAsset('a1', 'file:///Music/Song.mp3?token=1', 'Song.mp3'),
        mediaAsset('a2', 'file:///Music/Song.mp3?token=2', 'Song.mp3'),
        mediaAsset('a3', 'file:///Music/Other.mp3', 'Other.mp3'),
      ],
      endCursor: undefined,
      hasNextPage: false,
      totalCount: 3,
    }));

    const result = await scanAudioAssetsFromMediaLibrary(getAssetsPage as any);

    expect(result.assets.map(item => item.id)).toEqual(['a1', 'a3']);
    expect(result.skipped).toEqual([{ asset: expect.objectContaining({ id: 'a2' }), reason: 'duplicate-uri' }]);
  });

  test('enrichMediaLibraryAssets dedupes songs after metadata enrichment', async () => {
    const result = await enrichMediaLibraryAssets(
      [
        mediaAsset('a1', 'file:///Music/Song.mp3?token=1', 'Song.mp3') as any,
        mediaAsset('a2', 'file:///Music/Song.mp3?token=2', 'Song Copy.mp3') as any,
        mediaAsset('a3', 'file:///Music/Other.mp3', 'Other.mp3') as any,
      ],
      1,
      { readId3Tags: false, loadNativeCover: false },
    );

    expect(result.songs.map(song => song.uri).sort()).toEqual([
      'file:///Music/Other.mp3',
      'file:///Music/Song.mp3?token=1',
    ]);
    expect(result.sourceSummary[0]).toMatchObject({ imported: 2, skipped: 2, errors: 0 });
  });

  test('readAudioUrisFromSafDirectory dedupes repeated file entries and normalized query variants', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue([
      `${safUri('Music/Song.mp3')}?token=1`,
      `${safUri('Music/Song.mp3')}?token=2`,
      safUri('Music/Other.mp3'),
    ]);

    const result = await readAudioUrisFromSafDirectory(safUri('Music'));

    expect(result.files).toEqual([
      `${safUri('Music/Song.mp3')}?token=1`,
      safUri('Music/Other.mp3'),
    ]);
    expect(result.errors).toEqual([]);
  });

  test('scanFromSafFolders returns deduped SAF songs', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue([
      `${safUri('Music/Song.mp3')}?token=1`,
      `${safUri('Music/Song.mp3')}?token=2`,
      safUri('Music/Other.mp3'),
    ]);

    const result = await scanFromSafFolders(
      [{ id: 'f1', name: 'Root', uri: safUri('Music'), addedAt: 1, enabled: true }],
      { readId3Tags: false, loadNativeCover: false },
    );

    expect(result.songs).toHaveLength(2);
    expect(result.sourceSummary[0]).toMatchObject({ imported: 2, skipped: 0, errors: 0 });
  });
});
