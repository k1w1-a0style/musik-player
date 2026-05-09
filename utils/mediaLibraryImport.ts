import * as MediaLibrary from 'expo-media-library';
import { getInfoAsync, StorageAccessFramework } from 'expo-file-system/legacy';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { parseFilename } from './musicParser';
import { parseId3FromUri, type Id3Tags } from './id3Parser';
import { cacheBase64Cover, isBase64ImageDataUri } from './coverCache';
import { getAudioAssetRejectReason, isLikelyMusicAsset } from './audioImportFilter';

const PAGE_SIZE = 200;
const MAX_IMPORT_PAGES = 1000;
const ID3_WORKER_COUNT = 3;
export const MAX_SAF_FILES = 5000;
const MAX_SAF_DEPTH = 2;

const AUDIO_EXTENSIONS = new Set(['mp3', 'm4a', 'mp4', 'aac', 'flac', 'wav', 'ogg', 'opus', 'webm']);
const KNOWN_NON_AUDIO_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'txt', 'nfo', 'cue', 'lrc', 'm3u', 'm3u8', 'pls', 'pdf', 'json']);

const EXTENSION_MIME_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  webm: 'audio/webm',
};

type MediaAsset = MediaLibrary.Asset;
type GetAssetsResult = MediaLibrary.PagedInfo<MediaAsset>;
type GetAssetsPage = (options: MediaLibrary.AssetsOptions) => Promise<GetAssetsResult>;

export interface AudioImportScanResult {
  assets: MediaAsset[];
  skipped: Array<{ asset: MediaAsset; reason: string }>;
}

export interface ImportScanResult {
  songs: Song[];
  skipped: string[];
  errors: string[];
  sourceSummary: Array<{ source: 'media-library' | 'saf'; imported: number; skipped: number; errors: number }>;
  folderUpdates?: ScanFolder[];
}

export interface ImportSongsOptions {
  scanFolders?: ScanFolder[];
  platformOs?: string;
}

interface BuildSongSource {
  id: string;
  uri: string;
  filename?: string;
  durationMs?: number;
  mimeType?: string;
  source: 'media-library' | 'saf';
  size?: number;
}

export const deriveExtension = (input?: string): string | undefined => {
  if (!input) return undefined;
  const segment = (input.split('?')[0] ?? input).split('/').pop() ?? input;
  const dotIndex = segment.lastIndexOf('.');
  if (dotIndex < 0 || dotIndex === segment.length - 1) return undefined;
  return segment.slice(dotIndex + 1).toLowerCase();
};

export const deriveMimeType = (rawMimeType: unknown, extension?: string): string | undefined => {
  if (typeof rawMimeType === 'string') {
    const normalized = rawMimeType.trim().toLowerCase();
    if (normalized.startsWith('audio/') && normalized.includes('/')) return normalized;
  }
  return extension ? EXTENSION_MIME_MAP[extension] : undefined;
};

export const isAudioFileUri = (uri: string): boolean => {
  const extension = deriveExtension(uri);
  return extension ? AUDIO_EXTENSIONS.has(extension) : false;
};

export const classifySafReadDirectoryError = (error: unknown): 'not-directory' | 'permission' | 'unknown' => {
  const message = String((error as { message?: unknown })?.message ?? error).toLowerCase();
  if (
    message.includes('enotdir')
    || message.includes('not a directory')
    || message.includes('is not a directory')
    || message.includes('not directory')
    || message.includes('not a folder')
  ) return 'not-directory';
  if (
    message.includes('securityexception')
    || message.includes('permission')
    || message.includes('denied')
    || message.includes('access')
    || message.includes('unauthorized')
    || message.includes('eacces')
    || message.includes('eperm')
    || message.includes('revoked')
    || message.includes('provider error')
    || message.includes('provider failed')
  ) return 'permission';
  return 'unknown';
};

export const deriveFolderNameFromUri = (uri: string): string => {
  const cleaned = uri.replace(/\/+$/, '');
  const segment = (cleaned.split('/').pop() ?? '').replace(/%3A/gi, ':');
  try {
    return decodeURIComponent(segment) || 'Ordner';
  } catch {
    return segment || 'Ordner';
  }
};

const filenameFromUri = (uri: string): string => {
  const segment = uri.split('/').pop() ?? uri;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

const resolveAssetSize = async (uri: string, existing?: number): Promise<number | undefined> => {
  if (typeof existing === 'number' && existing > 0) return existing;
  try {
    const info = await getInfoAsync(uri);
    if (info.exists && typeof info.size === 'number' && info.size > 0) return info.size;
  } catch {
    return undefined;
  }
  return undefined;
};

export const buildSongFromImportSource = async (source: BuildSongSource, tags: Id3Tags = {}): Promise<Song> => {
  const importedAt = Date.now();
  const filename = source.filename ?? filenameFromUri(source.uri);
  const extension = deriveExtension(filename) ?? deriveExtension(source.uri);
  const fallback = parseFilename(filename);

  const cachedCover = await cacheBase64Cover(source.id, tags.cover);
  const cover = cachedCover ?? (tags.cover && !isBase64ImageDataUri(tags.cover) ? tags.cover : undefined);

  return {
    id: source.id,
    title: tags.title || fallback.title || filename.replace(/\.[^.]+$/, ''),
    artist: tags.artist || fallback.artist || 'Unbekannt',
    album: tags.album,
    duration: source.durationMs,
    year: tags.year,
    genre: tags.genre,
    uri: source.uri,
    cover,
    fileInfo: {
      filename,
      uri: source.uri,
      extension,
      container: extension,
      mimeType: deriveMimeType(source.mimeType, extension),
      size: await resolveAssetSize(source.uri, source.size),
      source: source.source,
      importedAt,
    },
    coverInfo: {
      status: cover ? (cachedCover ? 'cached' : 'external') : 'none',
      uri: cover,
    },
  };
};

export const readAudioUrisFromSafDirectory = async (
  directoryUri: string,
  readDirectory: (uri: string) => Promise<string[]> = StorageAccessFramework.readDirectoryAsync,
): Promise<{ files: string[]; errors: string[] }> => {
  const files: string[] = [];
  const errors: string[] = [];
  const visited = new Set<string>();

  // Expo SAF child entries are URI strings; getInfoAsync is not reliable for content:// dir detection.
  // We classify readDirectory failures by cause: not-directory -> ignore, permission/access -> report,
  // unknown -> ignore. Root failures are always reported to the user.
  const walk = async (uri: string, depth: number, reportError: boolean): Promise<void> => {
    if (visited.has(uri) || files.length >= MAX_SAF_FILES || depth > MAX_SAF_DEPTH) return;
    visited.add(uri);

    let entries: string[];
    try {
      entries = await readDirectory(uri);
    } catch (error) {
      if (reportError || classifySafReadDirectoryError(error) === 'permission') errors.push(uri);
      return;
    }

    for (const entry of entries) {
      if (files.length >= MAX_SAF_FILES) break;
      if (isAudioFileUri(entry)) {
        files.push(entry);
        continue;
      }
      if (depth < MAX_SAF_DEPTH) await walk(entry, depth + 1, false);
    }
  };

  await walk(directoryUri, 0, true);
  return { files, errors };
};

export const scanAudioAssetsFromMediaLibrary = async (
  getAssetsPage: GetAssetsPage = MediaLibrary.getAssetsAsync,
  options: { filterLikelyMusic?: boolean } = {},
): Promise<AudioImportScanResult> => {
  const { filterLikelyMusic = true } = options;
  const seenIds = new Set<string>();
  const assets: MediaAsset[] = [];
  const skipped: Array<{ asset: MediaAsset; reason: string }> = [];

  let pageCount = 0;
  let after: string | undefined;
  let previousCursor: string | undefined;

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
    if (!page.hasNextPage || !page.endCursor || page.endCursor === previousCursor) break;
    previousCursor = page.endCursor;
    after = page.endCursor;
  }

  return { assets, skipped };
};

export const scanMediaLibraryCandidates = async (): Promise<AudioImportScanResult> => scanAudioAssetsFromMediaLibrary();

export const enrichMediaLibraryAssets = async (assets: MediaAsset[], skippedCount = 0): Promise<ImportScanResult> => {
  const skipped: string[] = [];
  const songs: Song[] = [];
  const errors: string[] = [];
  const queue = [...assets];

  const workers = Array.from({ length: ID3_WORKER_COUNT }, async () => {
    while (queue.length > 0) {
      const asset = queue.shift();
      if (!asset) break;

      try {
        const tags = await parseId3FromUri(asset.uri).catch(() => ({}));
        songs.push(await buildSongFromImportSource({
          id: asset.id,
          uri: asset.uri,
          filename: asset.filename,
          durationMs: (asset.duration ?? 0) * 1000,
          mimeType: (asset as { mimeType?: string }).mimeType,
          size: (asset as { fileSize?: number }).fileSize,
          source: 'media-library',
        }, tags));
      } catch {
        errors.push(asset.uri);
      }
    }
  });

  await Promise.all(workers);
  songs.sort((a, b) => a.title.localeCompare(b.title));

  return {
    songs,
    skipped,
    errors,
    sourceSummary: [{ source: 'media-library', imported: songs.length, skipped: skippedCount, errors: errors.length }],
  };
};


export const scanFromMediaLibrary = async (): Promise<ImportScanResult> => {
  const candidates = await scanMediaLibraryCandidates();
  const result = await enrichMediaLibraryAssets(candidates.assets, candidates.skipped.length);
  result.skipped = candidates.skipped.map(item => `${item.asset.id}:${item.reason}`);
  return result;
};

export const scanFromSafFolders = async (folders: ScanFolder[]): Promise<ImportScanResult> => {
  const songs: Song[] = [];
  const errors: string[] = [];
  const skipped: string[] = [];
  const folderUpdates: ScanFolder[] = [];

  for (const folder of folders) {
    if (!folder.enabled) {
      skipped.push(`${folder.name}:disabled`);
      folderUpdates.push(folder);
      continue;
    }

    const { files, errors: folderErrors } = await readAudioUrisFromSafDirectory(folder.uri);

    if (folderErrors.length > 0) errors.push(...folderErrors);

    if (folderErrors.length > 0 && files.length === 0) folderUpdates.push({ ...folder, lastError: 'Nicht lesbar' });
    else if (folderErrors.length > 0) folderUpdates.push({ ...folder, lastError: 'Teilweise nicht lesbar' });
    else folderUpdates.push(folder.lastError ? { ...folder, lastError: undefined } : folder);

    for (const uri of files) {
      try {
        const tags = await parseId3FromUri(uri).catch(() => ({}));
        songs.push(await buildSongFromImportSource({ id: uri, uri, source: 'saf' }, tags));
      } catch {
        errors.push(uri);
        songs.push(await buildSongFromImportSource({ id: uri, uri, source: 'saf' }, {}));
      }
    }
  }

  const dedupedSongs = Array.from(new Map(songs.map(song => [song.uri, song])).values()).filter((song): song is Song => !!song);
  dedupedSongs.sort((a, b) => a.title.localeCompare(b.title));

  return {
    songs: dedupedSongs,
    skipped,
    errors,
    sourceSummary: [{ source: 'saf', imported: dedupedSongs.length, skipped: skipped.length, errors: errors.length }],
    folderUpdates,
  };
};

export const importSongsFromSources = async (options: ImportSongsOptions = {}): Promise<ImportScanResult> => {
  const { scanFolders = [], platformOs } = options;
  const activeSafFolders = scanFolders.filter(folder => folder.enabled);
  if (platformOs === 'android' && activeSafFolders.length > 0) return scanFromSafFolders(activeSafFolders);
  return scanFromMediaLibrary();
};

export const loadAllAudioAssetsFromMediaLibrary = async (
  getAssetsPage: GetAssetsPage = MediaLibrary.getAssetsAsync,
  options: { filterLikelyMusic?: boolean } = {},
): Promise<MediaAsset[]> => {
  const result = await scanAudioAssetsFromMediaLibrary(getAssetsPage, options);
  return result.assets;
};
