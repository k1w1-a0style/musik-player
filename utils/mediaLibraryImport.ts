import * as MediaLibrary from 'expo-media-library';

const PAGE_SIZE = 200;
const MAX_IMPORT_PAGES = 1000;

type MediaAsset = MediaLibrary.Asset;
type GetAssetsResult = MediaLibrary.PagedInfo<MediaAsset>;

type GetAssetsPage = (options: MediaLibrary.AssetsOptions) => Promise<GetAssetsResult>;

export const loadAllAudioAssetsFromMediaLibrary = async (
  getAssetsPage: GetAssetsPage = MediaLibrary.getAssetsAsync,
): Promise<MediaAsset[]> => {
  const allAssets: MediaAsset[] = [];
  const seenIds = new Set<string>();

  let after: string | undefined;
  let previousCursor: string | undefined;
  let pageCount = 0;

  while (pageCount < MAX_IMPORT_PAGES) {
    const page = await getAssetsPage({ mediaType: 'audio', first: PAGE_SIZE, ...(after ? { after } : {}) });

    for (const asset of page.assets) {
      if (seenIds.has(asset.id)) continue;
      seenIds.add(asset.id);
      allAssets.push(asset);
    }

    pageCount += 1;
    if (!page.hasNextPage) break;
    if (!page.endCursor) break;
    if (page.endCursor === previousCursor) break;

    previousCursor = page.endCursor;
    after = page.endCursor;
  }

  return allAssets;
};
