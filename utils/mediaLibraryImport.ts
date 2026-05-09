import * as MediaLibrary from 'expo-media-library';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { getAudioAssetRejectReason, isLikelyMusicAsset } from './audioImportFilter';

const PAGE_SIZE = 200;
const MAX_IMPORT_PAGES = 1000;
const MAX_SAF_FILES = 5000;

const AUDIO_EXTENSIONS = new Set(['mp3', 'm4a', 'mp4', 'aac', 'flac', 'wav', 'ogg', 'opus', 'webm']);

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

export const isAudioFileUri = (uri: string): boolean => {
  const cleaned = uri.split('?')[0] ?? uri;
  const segment = cleaned.split('/').pop() ?? cleaned;
  const dot = segment.lastIndexOf('.');
  if (dot < 0 || dot === segment.length - 1) return false;
  return AUDIO_EXTENSIONS.has(segment.slice(dot + 1).toLowerCase());
};

export const deriveFolderNameFromUri = (uri: string): string => {
  const cleaned = uri.replace(/\/+$/, '');
  const segment = decodeURIComponent((cleaned.split('/').pop() ?? '').replace(/%3A/gi, ':'));
  return segment || 'Ordner';
};

export const readAudioUrisFromSafDirectory = async (
  directoryUri: string,
  readDirectory: (uri: string) => Promise<string[]> = StorageAccessFramework.readDirectoryAsync,
): Promise<{ files: string[]; errors: string[] }> => {
  try {
    const entries = await readDirectory(directoryUri);
    const files = entries.filter(isAudioFileUri).slice(0, MAX_SAF_FILES);
    return { files, errors: [] };
  } catch {
    return { files: [], errors: [directoryUri] };
  }
};

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
