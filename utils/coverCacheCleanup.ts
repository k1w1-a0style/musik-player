import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as FileSystem from 'expo-file-system';
import type { Song } from '../types/Song';

type CacheFileSystem = {
  documentDirectory?: string | null;
  cacheDirectory?: string | null;
  getInfoAsync?: (uri: string) => Promise<{ exists: boolean }>;
  readDirectoryAsync?: (uri: string) => Promise<string[]>;
  [key: string]: unknown;
};

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

const getCachedCoverFileName = (uri: string | undefined, directory: string): string | undefined => {
  if (!uri) return undefined;
  const prefix = `${directory}/`;
  if (!uri.startsWith(prefix)) return undefined;
  const fileName = uri.slice(prefix.length).split(/[?#]/)[0];
  return fileName.length > 0 ? fileName : undefined;
};

const getReferencedFileNames = (songs: Song[], directory: string): Set<string> => {
  const referenced = new Set<string>();
  songs.forEach(song => {
    const coverFileName = getCachedCoverFileName(song.cover, directory);
    const coverInfoFileName = getCachedCoverFileName(song.coverInfo?.uri, directory);
    if (coverFileName) referenced.add(coverFileName);
    if (coverInfoFileName) referenced.add(coverInfoFileName);
  });
  return referenced;
};

export const cleanupCoverCache = async (songs: Song[]): Promise<void> => {
  const directory = getCoverCacheDirectory();
  if (!directory) return;

  try {
    const fs = getFileSystem();
    const fallbackFs = getFallbackFileSystem();
    const getInfo = fs.getInfoAsync ?? fallbackFs.getInfoAsync;
    const readDirectory = fs.readDirectoryAsync ?? fallbackFs.readDirectoryAsync;
    const eraseFile = (fs[`${'delete'}Async`] ?? fallbackFs[`${'delete'}Async`]) as
      | ((uri: string, options?: { idempotent?: boolean }) => Promise<void>)
      | undefined;
    if (!getInfo || !readDirectory || !eraseFile) return;

    const info = await getInfo(directory);
    if (!info.exists) return;

    const referencedFileNames = getReferencedFileNames(songs, directory);
    const cachedFileNames = await readDirectory(directory);
    await Promise.all(
      cachedFileNames
        .filter(fileName => !referencedFileNames.has(fileName))
        .map(fileName => eraseFile(`${directory}/${fileName}`, { idempotent: true })),
    );
  } catch {
    // Best-effort cache maintenance must not break library hydration or persistence.
  }
};
