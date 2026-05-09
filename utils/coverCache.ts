import {
  makeDirectoryAsync,
  writeAsStringAsync,
  EncodingType,
  documentDirectory,
  cacheDirectory,
} from 'expo-file-system/legacy';
import * as FileSystem from 'expo-file-system';
import type { Song } from '../types/Song';

const DATA_URI_RE = /^data:image\/([a-zA-Z0-9.+-]+);base64,/i;

export const isBase64ImageDataUri = (value?: string): boolean => {
  if (!value) return false;
  return DATA_URI_RE.test(value.trim());
};

const extensionFromMimeSubtype = (subtype: string): string => {
  const normalized = subtype.toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  return 'jpg';
};

const getBaseDirectory = (): string | undefined =>
  documentDirectory
  ?? cacheDirectory
  ?? (FileSystem as { documentDirectory?: string | null }).documentDirectory
  ?? (FileSystem as { cacheDirectory?: string | null }).cacheDirectory
  ?? undefined;

export const cacheBase64Cover = async (songId: string, cover?: string): Promise<string | undefined> => {
  if (!cover) return undefined;
  const trimmed = cover.trim();
  const match = trimmed.match(DATA_URI_RE);
  if (!match) return cover;

  const baseDir = getBaseDirectory();
  if (!baseDir) return undefined;

  try {
    const ext = extensionFromMimeSubtype(match[1] ?? 'jpeg');
    const directory = `${baseDir}covers`;
    const mkdir = makeDirectoryAsync
      ?? (FileSystem as unknown as { makeDirectoryAsync?: typeof makeDirectoryAsync }).makeDirectoryAsync;
    const write = writeAsStringAsync
      ?? (FileSystem as unknown as { writeAsStringAsync?: typeof writeAsStringAsync }).writeAsStringAsync;
    if (!mkdir || !write) return undefined;

    await mkdir(directory, { intermediates: true });

    const fileUri = `${directory}/${encodeURIComponent(songId)}.${ext}`;
    const base64 = trimmed.slice(match[0].length);
    const base64Encoding = (EncodingType.Base64 ?? 'base64') as 'base64';
    await write(fileUri, base64, {
      encoding: base64Encoding,
    });
    return fileUri;
  } catch {
    return undefined;
  }
};

export const sanitizeSongCover = async (song: Song): Promise<Song> => {
  if (!song.cover || !isBase64ImageDataUri(song.cover)) return song;
  const cachedUri = await cacheBase64Cover(song.id, song.cover);
  if (!cachedUri) return song;
  return { ...song, cover: cachedUri };
};

export const sanitizeSongsForStorage = async (songs: Song[]): Promise<Song[]> => {
  const sanitized = await Promise.all(songs.map(sanitizeSongCover));
  return sanitized;
};
