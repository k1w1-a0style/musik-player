import { loadAllAudioAssetsFromMediaLibrary } from '../mediaLibraryImport';

type MockAsset = { id: string };

type MockPage = {
  assets: MockAsset[];
  hasNextPage: boolean;
  endCursor?: string;
};

describe('loadAllAudioAssetsFromMediaLibrary', () => {
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
    expect(getAssetsPage).toHaveBeenCalledTimes(2);
  });

  test('deduplicates by id and keeps first seen order', async () => {
    const getAssetsPage = jest
      .fn()
      .mockResolvedValueOnce({ assets: [{ id: '1' }, { id: '2' }], hasNextPage: true, endCursor: 'a' })
      .mockResolvedValueOnce({ assets: [{ id: '2' }, { id: '3' }], hasNextPage: false, endCursor: 'b' });

    const result = await loadAllAudioAssetsFromMediaLibrary(getAssetsPage as any);

    expect(result.map(a => a.id)).toEqual(['1', '2', '3']);
  });

  test('stops when hasNextPage is true but endCursor is missing', async () => {
    const getAssetsPage = jest.fn().mockResolvedValue({
      assets: [{ id: '1' }],
      hasNextPage: true,
    });

    const result = await loadAllAudioAssetsFromMediaLibrary(getAssetsPage as any);

    expect(result.map(a => a.id)).toEqual(['1']);
    expect(getAssetsPage).toHaveBeenCalledTimes(1);
  });

  test('stops when endCursor does not advance', async () => {
    const getAssetsPage = jest
      .fn()
      .mockResolvedValueOnce({ assets: [{ id: '1' }], hasNextPage: true, endCursor: 'same' })
      .mockResolvedValueOnce({ assets: [{ id: '2' }], hasNextPage: true, endCursor: 'same' });

    const result = await loadAllAudioAssetsFromMediaLibrary(getAssetsPage as any);

    expect(result.map(a => a.id)).toEqual(['1', '2']);
    expect(getAssetsPage).toHaveBeenCalledTimes(2);
  });
});
