import {
  deriveFolderNameFromUri,
  isAudioFileUri,
  loadAllAudioAssetsFromMediaLibrary,
  readAudioUrisFromSafDirectory,
} from '../mediaLibraryImport';

type MockAsset = { id: string };

type MockPage = {
  assets: MockAsset[];
  hasNextPage: boolean;
  endCursor?: string;
};

describe('mediaLibraryImport', () => {
  test('loads all pages', async () => {
    const pages: MockPage[] = [
      { assets: [{ id: '1' }, { id: '2' }], hasNextPage: true, endCursor: 'a' },
      { assets: [{ id: '3' }], hasNextPage: false, endCursor: 'b' },
    ];

    const getAssetsPage = jest.fn(async ({ after }: { after?: string }) => {
      if (!after) return pages[0] as any;
      return pages[1] as any;
    });

    const result = await loadAllAudioAssetsFromMediaLibrary(getAssetsPage as any);

    expect(result.map(a => a.id)).toEqual(['1', '2', '3']);
  });

  test('detects supported audio extensions', () => {
    expect(isAudioFileUri('content://x/song.mp3')).toBe(true);
    expect(isAudioFileUri('content://x/song.txt')).toBe(false);
  });

  test('derives folder names from URI', () => {
    expect(deriveFolderNameFromUri('content://tree/primary%3AMusic')).toContain('Music');
  });

  test('reads SAF directory and keeps only audio', async () => {
    const read = jest.fn().mockResolvedValue(['content://x/a.mp3', 'content://x/b.jpg']);
    const result = await readAudioUrisFromSafDirectory('content://x', read);
    expect(result.files).toEqual(['content://x/a.mp3']);
  });
});
