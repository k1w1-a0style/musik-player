import * as MediaLibrary from 'expo-media-library';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import SystemAudio from 'expo-system-audio';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { parseFilename } from './musicParser';
import { parseId3FromUri, type Id3Tags } from './id3Parser';
import { cacheBase64Cover, isBase64ImageDataUri } from './coverCache';
import { getAudioAssetRejectReason, isLikelyMusicAsset, type AudioImportFilterOptions } from './audioImportFilter';
import { OperationAbortError, throwIfAborted } from './withTimeout';
import { AUDIO_EXTENSIONS, EXTENSION_MIME_MAP, KNOWN_NON_AUDIO_EXTENSIONS } from './audioExtensions';

const PAGE_SIZE = 200;
const MAX_IMPORT_PAGES = 1000;
// Not real threads/WebWorkers: two async readers interleave ID3 I/O on the JS queue.
const ID3_CONCURRENT_READERS = 2;
export const MAX_SAF_FILES = 5000;
const MAX_SAF_DEPTH = 2;
export const MAX_SAF_DIRECTORIES = 300;
// Bound each speculative SAF child-directory read; Android providers can hang on
// unknown entries. 4s is intentionally conservative enough for slower SAF
// providers while still keeping scans moving; callers can override in tests.
export const DEFAULT_SAF_READ_DIRECTORY_TIMEOUT_MS = 4_000;
const SAF_SCAN_YIELD_ENTRY_INTERVAL = 25;

type MediaAsset = MediaLibrary.Asset;
type GetAssetsResult = MediaLibrary.PagedInfo<MediaAsset>;
type GetAssetsPage = (options: MediaLibrary.AssetsOptions) => Promise<GetAssetsResult>;

export interface AudioImportScanResult {
  assets: MediaAsset[];
  skipped: Array<{ asset: MediaAsset; reason: string }>;
}

export interface MediaLibraryScanOptions extends AudioImportFilterOptions {
  /** Disable all likely-music checks when false; defaults to true. */
  filterLikelyMusic?: boolean;
  signal?: AbortSignal;
}

export interface ImportScanResult {
  songs: Song[];
  skipped: string[];
  errors: string[];
  sourceSummary: Array<{ source: 'media-library' | 'saf'; imported: number; skipped: number; errors: number }>;
  folderUpdates?: ScanFolder[];
}

export interface SafDirectoryScanProgress {
  filesFound: number;
  directoriesVisited: number;
  currentUri?: string;
  errorsFound: number;
}

export interface ImportSongsOptions {
  scanFolders?: ScanFolder[];
  platformOs?: string;
  loadNativeCovers?: boolean;
  readId3Tags?: boolean;
  signal?: AbortSignal;
  onSafProgress?: (progress: SafDirectoryScanProgress) => void;
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

interface BuildSongOptions {
  loadNativeCover?: boolean;
}

interface ImportEnrichmentOptions extends BuildSongOptions {
  readId3Tags?: boolean;
  signal?: AbortSignal;
}

interface SafImportOptions extends ImportEnrichmentOptions {
  readTimeoutMs?: number;
  onProgress?: (progress: SafDirectoryScanProgress) => void;
}

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const stripUriQueryAndFragment = (uri: string): string => uri.split(/[?#]/)[0] ?? uri;

export const normalizeImportUriForDedupe = (uri?: string): string | undefined => {
  if (!uri) return undefined;
  return safeDecode(stripUriQueryAndFragment(uri))
    .replace(/\\/g, '/')
    .replace(/\/+$/, '') || undefined;
};

const safDisplayPath = (uri: string): string => {
  const withoutQuery = stripUriQueryAndFragment(uri);
  const rawSegment = withoutQuery.split('/').pop() ?? withoutQuery;
  const decoded = safeDecode(rawSegment).replace(/^tree\//, '').replace(/^document\//, '');
  const colonIndex = decoded.indexOf(':');
  return colonIndex >= 0 ? decoded.slice(colonIndex + 1) : decoded;
};

const basenameFromPath = (value: string): string => {
  const cleaned = safeDecode(value).replace(/\\/g, '/').replace(/\/+$/, '');
  return cleaned.split('/').filter(Boolean).pop() ?? cleaned;
};

export const deriveSafDisplayName = (uri: string): string => basenameFromPath(safDisplayPath(uri)) || 'Unbekannt';

export const deriveExtension = (input?: string): string | undefined => {
  if (!input) return undefined;
  const segment = basenameFromPath(stripUriQueryAndFragment(input));
  const dotIndex = segment.lastIndexOf('.');
  if (dotIndex < 0 || dotIndex === segment.length - 1) return undefined;
  return segment.slice(dotIndex + 1).toLowerCase();
};

export const deriveMimeType = (rawMimeType: unknown, extension?: string): string | undefined => {
  if (typeof rawMimeType === 'string') {
    const normalized = rawMimeType.trim().toLowerCase();
    if (normalized.startsWith('audio/') && normalized.includes('/')) return normalized;
  }
  const normalizedExtension = extension?.trim().replace(/^\.+/, '').toLowerCase();
  return normalizedExtension ? EXTENSION_MIME_MAP[normalizedExtension] : undefined;
};

export const isAudioFileUri = (uri: string): boolean => {
  const extension = deriveExtension(uri);
  return extension ? AUDIO_EXTENSIONS.has(extension) : false;
};

export const shouldAttemptSafDirectoryRead = (uri: string): boolean => {
  const extension = deriveExtension(uri);
  if (!extension) return true;
  if (AUDIO_EXTENSIONS.has(extension)) return false;
  return !KNOWN_NON_AUDIO_EXTENSIONS.has(extension);
};

export type SafReadDirectoryErrorKind = 'timeout' | 'aborted' | 'session-skip' | 'native' | 'not-directory' | 'permission' | 'unknown';

const classifySafNativeReadErrorMessage = (error: unknown): 'not-directory' | 'permission' | 'unknown' => {
  const message = String((error as { message?: unknown })?.message ?? error).toLowerCase();
  if (message.includes('enotdir') || message.includes('not a directory') || message.includes('is not a directory') || message.includes('not directory') || message.includes('not a folder')) return 'not-directory';
  if (message.includes('timed out') || message.includes('timeout') || message.includes('securityexception') || message.includes('permission') || message.includes('denied') || message.includes('access') || message.includes("isn't readable") || message.includes('is not readable') || message.includes('not readable') || message.includes('cannot read') || message.includes("can't read") || message.includes('could not read') || message.includes('failed to read') || message.includes('read failed') || message.includes('unreadable') || message.includes('unauthorized') || message.includes('eacces') || message.includes('eperm') || message.includes('revoked') || message.includes('provider error') || message.includes('provider failed')) return 'permission';
  return 'unknown';
};

export const classifySafReadDirectoryError = (error: unknown): SafReadDirectoryErrorKind => {
  if (error instanceof SafDirectoryReadTimeoutError) return 'timeout';
  if (error instanceof SafDirectoryReadAbortedError) return 'aborted';
  if (error instanceof SafDirectoryReadSessionSkipError) return 'session-skip';
  if (error instanceof SafDirectoryNativeReadError) return 'native';
  return classifySafNativeReadErrorMessage(error);
};

export const deriveFolderNameFromUri = (uri: string): string => deriveSafDisplayName(uri) || 'Ordner';

const filenameFromUri = (uri: string): string => deriveSafDisplayName(uri) || uri;

const resolveAssetSize = async (_uri: string, existing?: number): Promise<number | undefined> => typeof existing === 'number' && existing > 0 ? existing : undefined;

const getNativeEmbeddedCover = async (uri: string): Promise<string | undefined> => {
  try {
    const artwork = await SystemAudio.extractEmbeddedArtwork(uri);
    return artwork?.uri;
  } catch {
    return undefined;
  }
};

const readId3TagsIfEnabled = async (uri: string, enabled: boolean): Promise<Id3Tags> => {
  if (!enabled) return {};
  return parseId3FromUri(uri).catch(() => ({}));
};

const bitrateFromSizeAndDuration = (size?: number, durationMs?: number): number | undefined => {
  if (!size || !durationMs || durationMs <= 0) return undefined;
  return Math.round((size * 8) / (durationMs / 1000) / 1000);
};

export const buildSongFromImportSource = async (
  source: BuildSongSource,
  tags: Id3Tags = {},
  options: BuildSongOptions = {},
): Promise<Song> => {
  const { loadNativeCover = true } = options;
  const importedAt = Date.now();
  const filename = source.filename ?? filenameFromUri(source.uri);
  const extension = deriveExtension(filename) ?? deriveExtension(source.uri);
  const fallback = parseFilename(filename);
  const cachedCover = await cacheBase64Cover(source.id, tags.cover);
  const parsedCover = cachedCover ?? (tags.cover && !isBase64ImageDataUri(tags.cover) ? tags.cover : undefined);
  const nativeCover = parsedCover || !loadNativeCover ? undefined : await getNativeEmbeddedCover(source.uri);
  const cover = parsedCover ?? nativeCover;
  const coverStatus = cover ? (cachedCover || nativeCover ? 'cached' : 'external') : 'none';
  const size = await resolveAssetSize(source.uri, source.size);

  return {
    id: source.id,
    title: tags.title || fallback.title || filename.replace(/\.[^.]+$/, ''),
    artist: tags.artist || fallback.artist || 'Unbekannt',
    album: tags.album,
    duration: source.durationMs,
    year: tags.year,
    genre: tags.genre,
    trackNumber: tags.trackNumber,
    discNumber: tags.discNumber,
    comment: tags.comment,
    uri: source.uri,
    cover,
    fileInfo: {
      filename,
      uri: source.uri,
      extension,
      container: extension,
      mimeType: deriveMimeType(source.mimeType, extension),
      size,
      source: source.source,
      importedAt,
    },
    audioInfo: {
      codec: extension,
      bitrate: bitrateFromSizeAndDuration(size, source.durationMs),
    },
    coverInfo: { status: coverStatus, uri: cover, embeddedArtworkChecked: loadNativeCover },
  };
};

const dedupeSongsByImportUri = (songs: Song[]): Song[] => {
  const seen = new Set<string>();
  return songs.filter(song => {
    const key = normalizeImportUriForDedupe(song.uri);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const addNormalizedSafError = (uri: string, errors: string[], seenErrors: Set<string>): void => {
  const normalizedUri = normalizeImportUriForDedupe(uri) ?? uri;
  if (seenErrors.has(normalizedUri)) return;
  seenErrors.add(normalizedUri);
  errors.push(normalizedUri);
};

interface SafDirectoryReadOptions {
  signal?: AbortSignal;
  readTimeoutMs?: number;
  onProgress?: (progress: SafDirectoryScanProgress) => void;
}

const safTimedOutDirectoryUris = new Set<string>();

export class SafDirectoryReadTimeoutError extends Error {
  readonly uri: string;
  readonly timeoutMs: number;

  constructor(uri: string, timeoutMs: number) {
    super(`SAF directory read timed out after ${timeoutMs}ms: ${uri}`);
    this.name = 'SafDirectoryReadTimeoutError';
    this.uri = uri;
    this.timeoutMs = timeoutMs;
  }
}

export class SafDirectoryReadAbortedError extends Error {
  readonly uri: string;
  readonly cause?: unknown;

  constructor(uri: string, cause?: unknown) {
    const reason = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : undefined;
    super(reason ? `SAF directory read aborted for ${uri}: ${reason}` : `SAF directory read aborted for ${uri}`);
    this.name = 'SafDirectoryReadAbortedError';
    this.uri = uri;
    this.cause = cause;
  }
}

export class SafDirectoryNativeReadError extends Error {
  readonly uri: string;
  readonly cause: unknown;

  constructor(uri: string, cause: unknown) {
    const reason = String((cause as { message?: unknown })?.message ?? cause);
    super(`SAF native directory read failed for ${uri}: ${reason}`);
    this.name = 'SafDirectoryNativeReadError';
    this.uri = uri;
    this.cause = cause;
  }
}

export class SafDirectoryReadSessionSkipError extends Error {
  readonly uri: string;

  constructor(uri: string) {
    super(`SAF directory read skipped after a previous timeout in this session: ${uri}`);
    this.name = 'SafDirectoryReadSessionSkipError';
    this.uri = uri;
  }
}

const abortErrorFromSignal = (uri: string, signal: AbortSignal): SafDirectoryReadAbortedError => {
  const reason = signal.reason;
  const cause = reason instanceof Error ? reason : new OperationAbortError(typeof reason === 'string' ? reason : undefined);
  return new SafDirectoryReadAbortedError(uri, cause);
};

const safTimeoutKey = (uri: string): string => normalizeImportUriForDedupe(uri) ?? uri;

export const resetSafTimedOutUrisForTests = (): void => {
  safTimedOutDirectoryUris.clear();
};

export const readSafDirectoryWithTimeout = async (
  uri: string,
  readDirectory: (uri: string) => Promise<string[]>,
  { signal, readTimeoutMs = DEFAULT_SAF_READ_DIRECTORY_TIMEOUT_MS }: SafDirectoryReadOptions = {},
): Promise<string[]> => {
  if (signal?.aborted) throw abortErrorFromSignal(uri, signal);

  const timeoutKey = safTimeoutKey(uri);
  if (safTimedOutDirectoryUris.has(timeoutKey)) {
    throw new SafDirectoryReadSessionSkipError(uri);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;

  try {
    const readPromise = Promise.resolve()
      .then(() => readDirectory(uri))
      .catch((error: unknown) => {
        throw new SafDirectoryNativeReadError(uri, error);
      });
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new SafDirectoryReadTimeoutError(uri, readTimeoutMs)), readTimeoutMs);
    });
    const abortPromise = new Promise<never>((_, reject) => {
      abortListener = () => {
        if (signal) reject(abortErrorFromSignal(uri, signal));
      };
      signal?.addEventListener('abort', abortListener, { once: true });
    });

    return await Promise.race([readPromise, timeoutPromise, abortPromise]);
  } catch (error) {
    if (error instanceof SafDirectoryReadTimeoutError) {
      safTimedOutDirectoryUris.add(timeoutKey);
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    if (signal && abortListener) signal.removeEventListener('abort', abortListener);
  }
};

const shouldRecordSafReadError = (error: unknown, reportError: boolean): boolean => {
  if (reportError) return true;
  if (error instanceof SafDirectoryReadTimeoutError || error instanceof SafDirectoryReadSessionSkipError) return true;
  if (error instanceof SafDirectoryNativeReadError) return classifySafNativeReadErrorMessage(error.cause) === 'permission';
  return classifySafReadDirectoryError(error) === 'permission';
};

const yieldToEventLoop = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

export const readAudioUrisFromSafDirectory = async (
  directoryUri: string,
  readDirectory: (uri: string) => Promise<string[]> = StorageAccessFramework.readDirectoryAsync,
  options: SafDirectoryReadOptions = {},
): Promise<{ files: string[]; errors: string[] }> => {
  const { signal, onProgress } = options;
  const files: string[] = [];
  const seenFiles = new Set<string>();
  const errors: string[] = [];
  const seenErrors = new Set<string>();
  const visited = new Set<string>();
  let processedEntriesSinceYield = 0;

  const emitProgress = (currentUri?: string): void => {
    onProgress?.({
      filesFound: files.length,
      directoriesVisited: visited.size,
      currentUri,
      errorsFound: errors.length,
    });
  };

  const recordSafError = (uri: string): void => {
    const previousErrorCount = errors.length;
    addNormalizedSafError(uri, errors, seenErrors);
    if (errors.length !== previousErrorCount) emitProgress(uri);
  };

  const maybeYield = async (force = false): Promise<void> => {
    if (!force && processedEntriesSinceYield < SAF_SCAN_YIELD_ENTRY_INTERVAL) return;
    processedEntriesSinceYield = 0;
    await yieldToEventLoop();
    throwIfAborted(signal);
  };

  const walk = async (uri: string, depth: number, reportError: boolean): Promise<void> => {
    throwIfAborted(signal);
    const normalizedDirectory = normalizeImportUriForDedupe(uri) ?? uri;
    if (visited.has(normalizedDirectory) || files.length >= MAX_SAF_FILES || depth > MAX_SAF_DEPTH || visited.size >= MAX_SAF_DIRECTORIES) return;
    visited.add(normalizedDirectory);
    emitProgress(uri);

    let entries: string[];
    try {
      throwIfAborted(signal);
      const rawEntries = await readSafDirectoryWithTimeout(uri, readDirectory, options);
      throwIfAborted(signal);
      if (!Array.isArray(rawEntries)) {
        recordSafError(uri);
        await maybeYield(true);
        return;
      }
      entries = rawEntries.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
      if (entries.length !== rawEntries.length) recordSafError(uri);
      emitProgress(uri);
      await maybeYield(true);
    } catch (error) {
      if (error instanceof SafDirectoryReadAbortedError) throw error;
      throwIfAborted(signal);
      if (shouldRecordSafReadError(error, reportError)) recordSafError(uri);
      else emitProgress(uri);
      await maybeYield(true);
      return;
    }

    for (const entry of entries) {
      throwIfAborted(signal);
      processedEntriesSinceYield += 1;
      if (files.length >= MAX_SAF_FILES) break;
      if (isAudioFileUri(entry)) {
        const normalizedFile = normalizeImportUriForDedupe(entry) ?? entry;
        if (!seenFiles.has(normalizedFile)) {
          seenFiles.add(normalizedFile);
          files.push(entry);
          emitProgress(entry);
        }
        await maybeYield();
        continue;
      }
      if (depth < MAX_SAF_DEPTH && visited.size < MAX_SAF_DIRECTORIES && shouldAttemptSafDirectoryRead(entry)) {
        throwIfAborted(signal);
        await walk(entry, depth + 1, false);
        emitProgress(entry);
        await maybeYield(true);
      } else {
        await maybeYield();
      }
    }
  };

  await walk(directoryUri, 0, true);
  throwIfAborted(signal);
  emitProgress(directoryUri);
  return { files, errors };
};

export const scanAudioAssetsFromMediaLibrary = async (
  getAssetsPage: GetAssetsPage = MediaLibrary.getAssetsAsync,
  options: MediaLibraryScanOptions = {},
): Promise<AudioImportScanResult> => {
  const { filterLikelyMusic = true, signal, ...filterOptions } = options;
  throwIfAborted(signal);
  const seenIds = new Set<string>();
  const seenUris = new Set<string>();
  const assets: MediaAsset[] = [];
  const skipped: Array<{ asset: MediaAsset; reason: string }> = [];
  let pageCount = 0;
  let after: string | undefined;
  let previousCursor: string | undefined;

  while (pageCount < MAX_IMPORT_PAGES) {
    throwIfAborted(signal);
    const page = await getAssetsPage({ mediaType: 'audio', first: PAGE_SIZE, ...(after ? { after } : {}) });
    throwIfAborted(signal);
    for (const asset of page.assets) {
      if (seenIds.has(asset.id)) continue;
      seenIds.add(asset.id);
      if (filterLikelyMusic && !isLikelyMusicAsset(asset, filterOptions)) {
        skipped.push({ asset, reason: getAudioAssetRejectReason(asset, filterOptions) ?? 'not-likely-music' });
        continue;
      }
      const normalizedUri = normalizeImportUriForDedupe(asset.uri);
      if (normalizedUri && seenUris.has(normalizedUri)) {
        skipped.push({ asset, reason: 'duplicate-uri' });
        continue;
      }
      if (normalizedUri) seenUris.add(normalizedUri);
      assets.push(asset);
    }
    pageCount += 1;
    if (!page.hasNextPage || !page.endCursor || page.endCursor === previousCursor) break;
    previousCursor = page.endCursor;
    after = page.endCursor;
  }
  return { assets, skipped };
};

export const scanMediaLibraryCandidates = async (options: MediaLibraryScanOptions = {}): Promise<AudioImportScanResult> => scanAudioAssetsFromMediaLibrary(MediaLibrary.getAssetsAsync, options);

export const enrichMediaLibraryAssets = async (
  assets: MediaAsset[],
  skippedCount = 0,
  options: ImportEnrichmentOptions = {},
): Promise<ImportScanResult> => {
  const { loadNativeCover = true, readId3Tags = true, signal } = options;
  throwIfAborted(signal);
  const skipped: string[] = [];
  const songs: Song[] = [];
  const errors: string[] = [];
  const queue = [...assets];

  const workers = Array.from({ length: ID3_CONCURRENT_READERS }, async () => {
    while (queue.length > 0) {
      throwIfAborted(signal);
      const asset = queue.shift();
      if (!asset) break;
      try {
        const tags = await readId3TagsIfEnabled(asset.uri, readId3Tags);
        throwIfAborted(signal);
        songs.push(await buildSongFromImportSource({
          id: asset.id,
          uri: asset.uri,
          filename: asset.filename,
          durationMs: (asset.duration ?? 0) * 1000,
          mimeType: (asset as { mimeType?: string }).mimeType,
          size: (asset as { fileSize?: number }).fileSize,
          source: 'media-library',
        }, tags, { loadNativeCover }));
        throwIfAborted(signal);
      } catch {
        errors.push(asset.uri);
      }
    }
  });

  await Promise.all(workers);
  throwIfAborted(signal);
  const dedupedSongs = dedupeSongsByImportUri(songs);
  dedupedSongs.sort((a, b) => a.title.localeCompare(b.title));
  return { songs: dedupedSongs, skipped, errors, sourceSummary: [{ source: 'media-library', imported: dedupedSongs.length, skipped: skippedCount + (songs.length - dedupedSongs.length), errors: errors.length }] };
};

export const scanFromMediaLibrary = async (options: ImportEnrichmentOptions = {}): Promise<ImportScanResult> => {
  throwIfAborted(options.signal);
  const candidates = await scanMediaLibraryCandidates({ signal: options.signal });
  throwIfAborted(options.signal);
  const result = await enrichMediaLibraryAssets(candidates.assets, candidates.skipped.length, options);
  result.skipped = candidates.skipped.map(item => `${item.asset.id}:${item.reason}`);
  return result;
};

export const scanFromSafFolders = async (
  folders: ScanFolder[],
  options: SafImportOptions = {},
): Promise<ImportScanResult> => {
  const { loadNativeCover = true, readId3Tags = true, signal, onProgress, readTimeoutMs } = options;
  throwIfAborted(signal);
  const songs: Song[] = [];
  const errors: string[] = [];
  const seenErrors = new Set<string>();
  const skipped: string[] = [];
  const folderUpdates: ScanFolder[] = [];

  const recordImportError = (uri: string): void => {
    addNormalizedSafError(uri, errors, seenErrors);
  };

  for (const folder of folders) {
    throwIfAborted(signal);
    if (!folder.enabled) {
      skipped.push(`${folder.name}:disabled`);
      folderUpdates.push(folder);
      continue;
    }

    const { files, errors: folderErrors } = await readAudioUrisFromSafDirectory(folder.uri, StorageAccessFramework.readDirectoryAsync, { signal, onProgress, readTimeoutMs });
    throwIfAborted(signal);
    if (folderErrors.length > 0) folderErrors.forEach(recordImportError);

    if (folderErrors.length > 0 && files.length === 0) folderUpdates.push({ ...folder, lastError: 'Nicht lesbar' });
    else if (folderErrors.length > 0) folderUpdates.push({ ...folder, lastError: 'Teilweise nicht lesbar' });
    else folderUpdates.push(folder.lastError ? { ...folder, lastError: undefined } : folder);

    for (const uri of files) {
      throwIfAborted(signal);
      try {
        const tags = await readId3TagsIfEnabled(uri, readId3Tags);
        throwIfAborted(signal);
        songs.push(await buildSongFromImportSource({ id: uri, uri, source: 'saf' }, tags, { loadNativeCover }));
        throwIfAborted(signal);
      } catch {
        throwIfAborted(signal);
        recordImportError(uri);
        songs.push(await buildSongFromImportSource({ id: uri, uri, source: 'saf' }, {}, { loadNativeCover }));
        throwIfAborted(signal);
      }
    }
  }

  throwIfAborted(signal);
  const dedupedSongs = dedupeSongsByImportUri(songs);
  dedupedSongs.sort((a, b) => a.title.localeCompare(b.title));
  return { songs: dedupedSongs, skipped, errors, sourceSummary: [{ source: 'saf', imported: dedupedSongs.length, skipped: skipped.length + (songs.length - dedupedSongs.length), errors: errors.length }], folderUpdates };
};

export const importSongsFromSources = async (options: ImportSongsOptions = {}): Promise<ImportScanResult> => {
  const { scanFolders = [], platformOs, loadNativeCovers, readId3Tags, signal, onSafProgress } = options;
  throwIfAborted(signal);
  const activeSafFolders = scanFolders.filter(folder => folder.enabled);
  if (platformOs === 'android' && activeSafFolders.length > 0) {
    return scanFromSafFolders(activeSafFolders, {
      loadNativeCover: loadNativeCovers ?? false,
      readId3Tags: readId3Tags ?? false,
      signal,
      onProgress: onSafProgress,
    });
  }
  return scanFromMediaLibrary({ loadNativeCover: loadNativeCovers ?? true, readId3Tags: readId3Tags ?? true, signal });
};

export const loadAllAudioAssetsFromMediaLibrary = async (
  getAssetsPage: GetAssetsPage = MediaLibrary.getAssetsAsync,
  options: Omit<MediaLibraryScanOptions, 'signal'> = {},
): Promise<MediaAsset[]> => {
  const result = await scanAudioAssetsFromMediaLibrary(getAssetsPage, options);
  return result.assets;
};