import * as MediaLibrary from 'expo-media-library';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import SystemAudio, { type AudioInfoResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { parseFilename, resolveDisplayArtist, resolveDisplayTitle, normalizeMetadataText } from './musicParser';
import { parseId3FromUri, type Id3Tags, type ParseId3Options } from './id3Parser';
import { cacheBase64Cover, isBase64ImageDataUri } from './coverCache';
import { getAudioAssetRejectReason, isLikelyMusicAsset, type AudioImportFilterOptions } from './audioImportFilter';
import { OperationAbortError, throwIfAborted } from './withTimeout';
import { EXTENSION_MIME_MAP, KNOWN_NON_AUDIO_EXTENSIONS } from './audioExtensions';
import { isSupportedAudioCandidate, normalizeAudioCandidateMimeType } from './audioImportCandidates';

const PAGE_SIZE = 200;
const MAX_IMPORT_PAGES = 1000;
// Not real threads/WebWorkers: two async readers interleave ID3 I/O on the JS queue.
const ID3_CONCURRENT_READERS = 2;
const SAF_ID3_CONCURRENT_READERS = 2;
export const MAX_SAF_FILES = 5000;
const MAX_SAF_DEPTH = 8;
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

export type ImportErrorPhase = 'directory' | 'tags' | 'audioInfo' | 'cover' | 'songBuild';

export interface ImportErrorDetail {
  uri: string;
  phase: ImportErrorPhase;
  code: string;
  message: string;
  recoverable: boolean;
}

export interface ImportScanResult {
  songs: Song[];
  skipped: string[];
  errors: string[];
  errorDetails?: ImportErrorDetail[];
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
  bitrateBps?: number;
  sampleRateHz?: number;
  channels?: number;
  audioMimeType?: string;
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
    const normalized = normalizeAudioCandidateMimeType(rawMimeType);
    if (normalized?.startsWith('audio/') && normalized.includes('/')) return normalized;
  }
  const normalizedExtension = extension?.trim().replace(/^\.+/, '').toLowerCase();
  return normalizedExtension ? EXTENSION_MIME_MAP[normalizedExtension] : undefined;
};

export const isAudioFileUri = (uri: string): boolean => isSupportedAudioCandidate({ uri }).accepted;

export const shouldAttemptSafDirectoryRead = (uri: string): boolean => {
  const extension = deriveExtension(uri);
  if (!extension) return true;
  const audioDecision = isSupportedAudioCandidate({ uri });
  if (audioDecision.accepted) return false;
  if (audioDecision.reason === 'mp4-without-audio-mime') return false;
  return !KNOWN_NON_AUDIO_EXTENSIONS.has(extension);
};

export type SafReadDirectoryErrorKind = 'timeout' | 'aborted' | 'session-skip' | 'capacity' | 'native' | 'not-directory' | 'permission' | 'unknown';

const SAF_NOT_DIRECTORY_ERROR_MARKERS = [
  'enotdir',
  'not a directory',
  'is not a directory',
  'not directory',
  'not a folder',
] as const;

const SAF_PERMISSION_ERROR_MARKERS = [
  'timed out',
  'timeout',
  'securityexception',
  'permission',
  'denied',
  'access',
  "isn't readable",
  'is not readable',
  'not readable',
  'cannot read',
  "can't read",
  'could not read',
  'failed to read',
  'read failed',
  'unreadable',
  'unauthorized',
  'eacces',
  'eperm',
  'revoked',
  'provider error',
  'provider failed',
] as const;

const includesAnyMarker = (message: string, markers: readonly string[]): boolean =>
  markers.some(marker => message.includes(marker));

const classifySafNativeReadErrorMessage = (error: unknown): 'not-directory' | 'permission' | 'unknown' => {
  const message = String((error as { message?: unknown })?.message ?? error).toLowerCase();
  if (includesAnyMarker(message, SAF_NOT_DIRECTORY_ERROR_MARKERS)) return 'not-directory';
  if (includesAnyMarker(message, SAF_PERMISSION_ERROR_MARKERS)) return 'permission';
  return 'unknown';
};

export const classifySafReadDirectoryError = (error: unknown): SafReadDirectoryErrorKind => {
  if (error instanceof SafDirectoryReadTimeoutError) return 'timeout';
  if (error instanceof SafDirectoryReadAbortedError) return 'aborted';
  if (error instanceof SafDirectoryReadSessionSkipError) return 'session-skip';
  if (error instanceof SafDirectoryReadCapacityError) return 'capacity';
  if (error instanceof SafDirectoryNativeReadError) return 'native';
  return classifySafNativeReadErrorMessage(error);
};

export const deriveFolderNameFromUri = (uri: string): string => deriveSafDisplayName(uri) || 'Ordner';

const filenameFromUri = (uri: string): string => deriveSafDisplayName(uri) || uri;

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const preferPositiveNumber = (incoming?: unknown, fallback?: unknown): number | undefined => {
  if (isPositiveFiniteNumber(incoming)) return incoming;
  if (isPositiveFiniteNumber(fallback)) return fallback;
  return undefined;
};

const durationSecondsToMs = (durationSeconds?: unknown): number | undefined =>
  isPositiveFiniteNumber(durationSeconds) ? durationSeconds * 1000 : undefined;

const resolveAssetSize = async (_uri: string, existing?: number): Promise<number | undefined> => preferPositiveNumber(existing);

const getNativeAudioInfo = async (uri: string): Promise<AudioInfoResult | null> => {
  try {
    return await SystemAudio.extractAudioInfo(uri);
  } catch {
    return null;
  }
};

const mergeAudioInfoIntoSource = (source: BuildSongSource, audioInfo: AudioInfoResult | null): BuildSongSource => ({
  ...source,
  filename: source.filename ?? audioInfo?.displayName,
  durationMs: preferPositiveNumber(source.durationMs, audioInfo?.durationMs),
  mimeType: source.mimeType ?? audioInfo?.mimeType,
  audioMimeType: audioInfo?.mimeType,
  size: preferPositiveNumber(source.size, audioInfo?.sizeBytes),
  bitrateBps: preferPositiveNumber(source.bitrateBps, audioInfo?.bitrateBps),
  sampleRateHz: preferPositiveNumber(source.sampleRateHz, audioInfo?.sampleRateHz),
  channels: preferPositiveNumber(source.channels, audioInfo?.channels),
});

const getNativeEmbeddedCover = async (uri: string): Promise<string | undefined> => {
  try {
    const artwork = await SystemAudio.extractEmbeddedArtwork(uri);
    return artwork?.uri;
  } catch {
    return undefined;
  }
};

const readId3TagsIfEnabled = async (uri: string, enabled: boolean, signal?: AbortSignal, hints: Pick<ParseId3Options, 'filename' | 'mimeType' | 'extension'> = {}): Promise<Id3Tags> => {
  if (!enabled) return {};
  try {
    return await parseId3FromUri(uri, { signal, ...hints });
  } catch {
    throwIfAborted(signal);
    return {};
  }
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
  const tagTitle = normalizeMetadataText(tags.title);
  const tagArtist = normalizeMetadataText(tags.artist);
  const cachedCover = await cacheBase64Cover(source.id, tags.cover);
  const parsedCover = cachedCover ?? (tags.cover && !isBase64ImageDataUri(tags.cover) ? tags.cover : undefined);
  const nativeCover = parsedCover || !loadNativeCover ? undefined : await getNativeEmbeddedCover(source.uri);
  const cover = parsedCover ?? nativeCover;
  const coverStatus = cover ? (cachedCover || nativeCover ? 'cached' : 'external') : 'none';
  const size = await resolveAssetSize(source.uri, source.size);

  return {
    id: source.id,
    title: resolveDisplayTitle(tagTitle ?? fallback.title, filename, source.uri),
    artist: resolveDisplayArtist(tagArtist ?? fallback.artist),
    albumArtist: normalizeMetadataText(tags.albumArtist),
    album: normalizeMetadataText(tags.album),
    duration: source.durationMs,
    year: normalizeMetadataText(tags.year),
    genre: normalizeMetadataText(tags.genre),
    trackNumber: normalizeMetadataText(tags.trackNumber),
    discNumber: normalizeMetadataText(tags.discNumber),
    comment: normalizeMetadataText(tags.comment),
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
      codec: source.audioMimeType ?? extension,
      bitrate: source.bitrateBps && source.bitrateBps > 0 ? Math.round(source.bitrateBps / 1000) : bitrateFromSizeAndDuration(size, source.durationMs),
      sampleRate: source.sampleRateHz,
      channels: source.channels,
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

const importErrorCode = (error: unknown): string => {
  if (error instanceof SafDirectoryReadTimeoutError) return 'saf-timeout';
  if (error instanceof SafDirectoryReadSessionSkipError) return 'saf-session-skip';
  if (error instanceof SafDirectoryReadAbortedError || error instanceof OperationAbortError) return 'aborted';
  const name = typeof (error as { name?: unknown })?.name === 'string'
    ? String((error as { name?: unknown }).name)
    : 'Error';
  return name.replace(/Error$/, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() || 'unknown';
};

const importErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const addImportErrorDetail = (
  uri: string,
  phase: ImportErrorPhase,
  error: unknown,
  recoverable: boolean,
  errorDetails: ImportErrorDetail[],
  seenDetails: Set<string>,
): void => {
  const normalizedUri = normalizeImportUriForDedupe(uri) ?? uri;
  const code = importErrorCode(error);
  // A recoverable primary failure and a terminal fallback failure are distinct
  // parts of the import contract, even when both happen to share an error
  // class/code. Do not let the earlier diagnostic hide the terminal failure.
  const key = `${normalizedUri}|${phase}|${code}|${recoverable ? 'recoverable' : 'terminal'}`;
  if (seenDetails.has(key)) return;
  seenDetails.add(key);
  errorDetails.push({
    uri: normalizedUri,
    phase,
    code,
    message: importErrorMessage(error),
    recoverable,
  });
};

interface SafDirectoryReadOptions {
  signal?: AbortSignal;
  readTimeoutMs?: number;
  onProgress?: (progress: SafDirectoryScanProgress) => void;
  /** Per top-level scan only. Never share this set across user-initiated scans. */
  timedOutDirectoryUris?: Set<string>;
}

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

export class SafDirectoryReadCapacityError extends Error {
  readonly uri: string;

  constructor(uri: string) {
    super(`SAF directory read capacity is busy; retry after active provider reads settle: ${uri}`);
    this.name = 'SafDirectoryReadCapacityError';
    this.uri = uri;
  }
}

const abortErrorFromSignal = (uri: string, signal: AbortSignal): SafDirectoryReadAbortedError => {
  const reason = signal.reason;
  const cause = reason instanceof Error ? reason : new OperationAbortError(typeof reason === 'string' ? reason : undefined);
  return new SafDirectoryReadAbortedError(uri, cause);
};

const safTimeoutKey = (uri: string): string => normalizeImportUriForDedupe(uri) ?? uri;

const MAX_SAF_NATIVE_READS_IN_FLIGHT = 2;
let safNativeReadsInFlight = 0;
let safNativeReadGeneration = 0;

// Timeout state is scan-local. The generation also isolates detached native
// promises left by timeout tests so late settlement cannot corrupt a new test.
export const resetSafTimedOutUrisForTests = (): void => {
  safNativeReadGeneration += 1;
  safNativeReadsInFlight = 0;
};

export const readSafDirectoryWithTimeout = async (
  uri: string,
  readDirectory: (uri: string) => Promise<string[]>,
  {
    signal,
    readTimeoutMs = DEFAULT_SAF_READ_DIRECTORY_TIMEOUT_MS,
    timedOutDirectoryUris,
  }: SafDirectoryReadOptions = {},
): Promise<string[]> => {
  if (signal?.aborted) throw abortErrorFromSignal(uri, signal);

  const timeoutKey = safTimeoutKey(uri);
  if (timedOutDirectoryUris?.has(timeoutKey)) {
    throw new SafDirectoryReadSessionSkipError(uri);
  }
  if (safNativeReadsInFlight >= MAX_SAF_NATIVE_READS_IN_FLIGHT) {
    throw new SafDirectoryReadCapacityError(uri);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;
  const readGeneration = safNativeReadGeneration;
  safNativeReadsInFlight += 1;

  try {
    const nativeSettlement = Promise.resolve()
      .then(() => readDirectory(uri))
      .then(
        value => ({ kind: 'value' as const, value }),
        error => ({ kind: 'error' as const, error }),
      );
    void nativeSettlement.then(() => {
      if (safNativeReadGeneration === readGeneration) {
        safNativeReadsInFlight = Math.max(0, safNativeReadsInFlight - 1);
      }
    });
    const readPromise = nativeSettlement.then(result => {
      if (result.kind === 'error') throw new SafDirectoryNativeReadError(uri, result.error);
      return result.value;
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
      timedOutDirectoryUris?.add(timeoutKey);
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    if (signal && abortListener) signal.removeEventListener('abort', abortListener);
  }
};

const shouldRecordSafReadError = (error: unknown, reportError: boolean): boolean => {
  if (reportError) return true;
  if (error instanceof SafDirectoryReadTimeoutError
    || error instanceof SafDirectoryReadSessionSkipError
    || error instanceof SafDirectoryReadCapacityError) return true;
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
  const scanOptions: SafDirectoryReadOptions = {
    ...options,
    timedOutDirectoryUris: options.timedOutDirectoryUris ?? new Set<string>(),
  };
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
      const rawEntries = await readSafDirectoryWithTimeout(uri, readDirectory, scanOptions);
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
  const errorDetails: ImportErrorDetail[] = [];
  const seenErrorDetails = new Set<string>();
  const queue = [...assets];

  const workers = Array.from({ length: ID3_CONCURRENT_READERS }, async () => {
    while (queue.length > 0) {
      throwIfAborted(signal);
      const asset = queue.shift();
      if (!asset) break;
      try {
        const assetMimeType = (asset as { mimeType?: string }).mimeType;
        const assetExtension = deriveExtension(asset.filename ?? asset.uri);
        const tags = await readId3TagsIfEnabled(asset.uri, readId3Tags, signal, {
          filename: asset.filename,
          mimeType: assetMimeType,
          extension: assetExtension,
        });
        throwIfAborted(signal);
        const audioInfo = await getNativeAudioInfo(asset.uri);
        throwIfAborted(signal);
        songs.push(await buildSongFromImportSource(mergeAudioInfoIntoSource({
          id: asset.id,
          uri: asset.uri,
          filename: asset.filename,
          durationMs: durationSecondsToMs(asset.duration),
          mimeType: assetMimeType,
          size: (asset as { fileSize?: number }).fileSize,
          source: 'media-library',
        }, audioInfo), tags, { loadNativeCover }));
        throwIfAborted(signal);
      } catch (error) {
        errors.push(asset.uri);
        addImportErrorDetail(asset.uri, 'songBuild', error, true, errorDetails, seenErrorDetails);
      }
    }
  });

  await Promise.all(workers);
  throwIfAborted(signal);
  const dedupedSongs = dedupeSongsByImportUri(songs);
  dedupedSongs.sort((a, b) => a.title.localeCompare(b.title));
  return { songs: dedupedSongs, skipped, errors, errorDetails, sourceSummary: [{ source: 'media-library', imported: dedupedSongs.length, skipped: skippedCount + (songs.length - dedupedSongs.length), errors: errors.length }] };
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
  const errorDetails: ImportErrorDetail[] = [];
  const seenErrorDetails = new Set<string>();
  const timedOutDirectoryUris = new Set<string>();
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

    const { files, errors: folderErrors } = await readAudioUrisFromSafDirectory(folder.uri, StorageAccessFramework.readDirectoryAsync, {
      signal,
      onProgress,
      readTimeoutMs,
      timedOutDirectoryUris,
    });
    throwIfAborted(signal);
    if (folderErrors.length > 0) {
      folderErrors.forEach(uri => {
        recordImportError(uri);
        addImportErrorDetail(uri, 'directory', new Error('SAF directory could not be read.'), true, errorDetails, seenErrorDetails);
      });
    }

    if (folderErrors.length > 0 && files.length === 0) folderUpdates.push({ ...folder, lastError: 'Nicht lesbar' });
    else if (folderErrors.length > 0) folderUpdates.push({ ...folder, lastError: 'Teilweise nicht lesbar' });
    else folderUpdates.push(folder.lastError ? { ...folder, lastError: undefined } : folder);

    const queue = [...files];
    const workers = Array.from({ length: Math.min(SAF_ID3_CONCURRENT_READERS, queue.length || 1) }, async () => {
      while (queue.length > 0) {
        throwIfAborted(signal);
        const uri = queue.shift();
        if (!uri) return;
        try {
          const tags = await readId3TagsIfEnabled(uri, readId3Tags, signal, { extension: deriveExtension(uri) });
          throwIfAborted(signal);
          const audioInfo = await getNativeAudioInfo(uri);
          throwIfAborted(signal);
          songs.push(await buildSongFromImportSource(mergeAudioInfoIntoSource({ id: uri, uri, source: 'saf' }, audioInfo), tags, { loadNativeCover }));
          throwIfAborted(signal);
        } catch (primaryError) {
          throwIfAborted(signal);
          recordImportError(uri);
          addImportErrorDetail(uri, 'songBuild', primaryError, true, errorDetails, seenErrorDetails);
          try {
            const audioInfo = await getNativeAudioInfo(uri);
            throwIfAborted(signal);
            songs.push(await buildSongFromImportSource(
              mergeAudioInfoIntoSource({ id: uri, uri, source: 'saf' }, audioInfo),
              {},
              { loadNativeCover },
            ));
            throwIfAborted(signal);
          } catch (fallbackError) {
            throwIfAborted(signal);
            addImportErrorDetail(uri, 'songBuild', fallbackError, false, errorDetails, seenErrorDetails);
          }
        }
      }
    });
    await Promise.all(workers);
  }

  throwIfAborted(signal);
  const dedupedSongs = dedupeSongsByImportUri(songs);
  dedupedSongs.sort((a, b) => a.title.localeCompare(b.title));
  return { songs: dedupedSongs, skipped, errors, errorDetails, sourceSummary: [{ source: 'saf', imported: dedupedSongs.length, skipped: skipped.length + (songs.length - dedupedSongs.length), errors: errors.length }], folderUpdates };
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
