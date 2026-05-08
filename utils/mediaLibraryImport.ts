import * as MediaLibrary from 'expo-media-library';
import { getAudioAssetRejectReason, isLikelyMusicAsset } from './audioImportFilter';

const PAGE_SIZE = 200;
const MAX_IMPORT_PAGES = 1000;

type MediaAsset = MediaLibrary.Asset;
type GetAssetsResult = MediaLibrary.PagedInfo<MediaAsset>;
type GetAssetsPage = (options: MediaLibrary.AssetsOptions) => Promise<GetAssetsResult>;

export interface AudioImportScanResult {
  assets: MediaAsset[];
  skipped: Array<{ asset: MediaAsset; reason: string }>;
}

interface LoadAudioAssetsOptions {
  filterLikelyMusic?: boolean;
}

export const scanAudioAssetsFromMediaLibrary = async (
  getAssetsPage: GetAssetsPage = MediaLibrary.getAssetsAsync,
  options: LoadAudioAssetsOptions = {},
): Promise<AudioImportScanResult> => {
  const { filterLikelyMusic = true } = options;
  const assets: MediaAsset[] = [];
  const skipped: Array<{ asset: MediaAsset; reason: string }> = [];
  const seenIds = new Set<string>();

  let after: string | undefined;
  let previousCursor: string | undefined;
  let pageCount = 0;

  while (pageCount < MAX_IMPORT_PAGES) {
    const page = await getAssetsPage({ mediaType: 'audio', first: PAGE_SIZE, ...(after ? { after } : {}) });

    for (const asset of page.assets) {
      if (seenIds.has(asset.id)) continue;
      seenIds.add(asset.id);

      if (filterLikelyMusic && !isLikelyMusicAsset(asset)) {
        skipped.push({ asset, reason: getAudioAssetRejectReason(asset) ?? 'not-likely-music' });
        continue;
      }

      assets.push(asset);
    }

    pageCount += 1;
    if (!page.hasNextPage) break;
    if (!page.endCursor) break;
    if (page.endCursor === previousCursor) break;

    previousCursor = page.endCursor;
    after = page.endCursor;
  }

  return { assets, skipped };
};

export const loadAllAudioAssetsFromMediaLibrary = async (
  getAssetsPage: GetAssetsPage = MediaLibrary.getAssetsAsync,
  options: LoadAudioAssetsOptions = {},
): Promise<MediaAsset[]> => {
  const result = await scanAudioAssetsFromMediaLibrary(getAssetsPage, options);
  return result.assets;
};
