import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as FileSystem from 'expo-file-system';
import type { Song } from '../types/Song';

type CacheFileSystem = {
  documentDirectory?: string | null;
  cacheDirectory?: string | null;
  getInfoAsync?: (uri: string) => Promise<{ exists: boolean }>;
  readDirectoryAsync?: (uri: string) => Promise<string[]>;
  deleteAsync?: (uri: string, options?: { idempotent?: boolean }) => Promise<void>;
};

const CLEANUP_DELETE_BATCH_SIZE = 20;
const CACHE_FILE_NAME_RE = /^[a-f0-9]+-[a-f0-9]+\.(?:jpg|jpeg|png|webp)$/i;

let latestCleanupRequestId = 0;
let latestCleanupSongs: Song[] | undefined;
let cleanupDrainPromise: Promise<void> | undefined;
export type CoverCacheProtection = symbol;

const activeCoverProtections = new Map<CoverCacheProtection, Set<string>>();

const isLatestCleanupRequest = (requestId: number): boolean => requestId === latestCleanupRequestId;

const getFileSystem = (): CacheFileSystem => LegacyFileSystem as CacheFileSystem;

const getFallbackFileSystem = (): CacheFileSystem => FileSystem as CacheFileSystem;

export const getCoverCacheDirectory = (): string | undefined => {
  const fs = getFileSystem();
  const fallbackFs = getFallbackFileSystem();
  const baseDir = fs.documentDirectory
    ?? fs.cacheDirectory
    ?? fallbackFs.documentDirectory
    ?? fallbackFs.cacheDirectory
    ?? undefined;
  return baseDir ? `${baseDir}covers` : undefined;
};

export const isSafeCoverCacheFileName = (fileName: string): boolean =>
  CACHE_FILE_NAME_RE.test(fileName) && !fileName.includes('/') && !fileName.includes('\\');

const getCachedCoverFileName = (uri: string | undefined, directory: string): string | undefined => {
  if (!uri) return undefined;
  const prefix = `${directory}/`;
  if (!uri.startsWith(prefix)) return undefined;
  const fileName = uri.slice(prefix.length).split(/[?#]/)[0];
  return fileName.length > 0 && isSafeCoverCacheFileName(fileName) ? fileName : undefined;
};

const getProtectedCoverFileNames = (): Set<string> => {
  const protectedFileNames = new Set<string>();
  activeCoverProtections.forEach(fileNames => fileNames.forEach(fileName => protectedFileNames.add(fileName)));
  return protectedFileNames;
};

const isCoverFileProtected = (fileName: string): boolean =>
  Array.from(activeCoverProtections.values()).some(fileNames => fileNames.has(fileName));

const getReferencedFileNames = (songs: Song[], directory: string): Set<string> => {
  const referenced = getProtectedCoverFileNames();
  songs.forEach(song => {
    const coverFileName = getCachedCoverFileName(song.cover, directory);
    const coverInfoFileName = getCachedCoverFileName(song.coverInfo?.uri, directory);
    if (coverFileName) referenced.add(coverFileName);
    if (coverInfoFileName) referenced.add(coverInfoFileName);
  });
  return referenced;
};

const deleteFilesInBatches = async (
  fileNames: string[],
  directory: string,
  eraseFile: (uri: string, options?: { idempotent?: boolean }) => Promise<void>,
  shouldContinue: () => boolean,
  isProtected: (fileName: string) => boolean,
): Promise<void> => {
  const safeFileNames = fileNames.filter(isSafeCoverCacheFileName);
  for (let i = 0; i < safeFileNames.length; i += CLEANUP_DELETE_BATCH_SIZE) {
    if (!shouldContinue()) return;
    const batch = safeFileNames.slice(i, i + CLEANUP_DELETE_BATCH_SIZE);
    for (const fileName of batch) {
      if (!shouldContinue()) return;
      if (isProtected(fileName)) continue;
      await eraseFile(`${directory}/${fileName}`, { idempotent: true });
    }
  }
};

const runCleanupCoverCache = async (songs: Song[], requestId: number): Promise<void> => {
  await Promise.resolve();
  if (!isLatestCleanupRequest(requestId)) return;
  const directory = getCoverCacheDirectory();
  if (!directory) return;

  try {
    const fs = getFileSystem();
    const fallbackFs = getFallbackFileSystem();
    const getInfo = fs.getInfoAsync ?? fallbackFs.getInfoAsync;
    const readDirectory = fs.readDirectoryAsync ?? fallbackFs.readDirectoryAsync;
    const eraseFile = fs.deleteAsync ?? fallbackFs.deleteAsync;
    if (!getInfo || !readDirectory || !eraseFile) return;

    const info = await getInfo(directory);
    if (!info.exists || !isLatestCleanupRequest(requestId)) return;

    const referencedFileNames = getReferencedFileNames(songs, directory);
    const cachedFileNames = await readDirectory(directory);
    if (!isLatestCleanupRequest(requestId)) return;
    const orphanedFileNames = cachedFileNames.filter(
      fileName => isSafeCoverCacheFileName(fileName) && !referencedFileNames.has(fileName),
    );
    await deleteFilesInBatches(
      orphanedFileNames,
      directory,
      eraseFile,
      () => isLatestCleanupRequest(requestId),
      isCoverFileProtected,
    );
  } catch {
    // Best-effort cache maintenance must not break library hydration or persistence.
  }
};

const drainLatestCleanup = async (): Promise<void> => {
  while (true) {
    const requestId = latestCleanupRequestId;
    const songs = latestCleanupSongs;
    if (!songs) return;
    await runCleanupCoverCache(songs, requestId);
    if (requestId === latestCleanupRequestId) return;
  }
};

export const invalidateCoverCacheCleanup = (): void => {
  latestCleanupRequestId += 1;
  latestCleanupSongs = undefined;
};

export const beginCoverCacheProtection = (songs: Song[] = []): CoverCacheProtection => {
  const protection = Symbol('cover-cache-protection');
  const directory = getCoverCacheDirectory();
  const protectedFileNames = new Set<string>();
  if (directory) {
    songs.forEach(song => {
      const coverFileName = getCachedCoverFileName(song.cover, directory);
      const coverInfoFileName = getCachedCoverFileName(song.coverInfo?.uri, directory);
      if (coverFileName) protectedFileNames.add(coverFileName);
      if (coverInfoFileName) protectedFileNames.add(coverInfoFileName);
    });
  }
  activeCoverProtections.set(protection, protectedFileNames);
  return protection;
};

export const releaseCoverCacheProtection = (protection: CoverCacheProtection): void => {
  activeCoverProtections.delete(protection);
};

export const protectCoverCacheUri = (uri: string | undefined): void => {
  const directory = getCoverCacheDirectory();
  if (!directory) return;
  const fileName = getCachedCoverFileName(uri, directory);
  if (!fileName) return;
  activeCoverProtections.forEach(fileNames => fileNames.add(fileName));
};

export const waitForCoverCacheCleanupIdle = async (): Promise<void> => {
  await cleanupDrainPromise;
};

export const cleanupCoverCache = async (songs: Song[]): Promise<void> => {
  latestCleanupRequestId += 1;
  latestCleanupSongs = songs;
  if (!cleanupDrainPromise) {
    cleanupDrainPromise = drainLatestCleanup().finally(() => {
      cleanupDrainPromise = undefined;
    });
  }
  await cleanupDrainPromise;
};
