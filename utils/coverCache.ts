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

const legacyFs = FileSystem as unknown as {
  cacheDirectory?: string;
  documentDirectory?: string;
  EncodingType?: { Base64: string };
};

const getBaseDirectory = (): string | undefined =>
  legacyFs.documentDirectory ?? legacyFs.cacheDirectory;

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
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

    const fileUri = `${directory}/${encodeURIComponent(songId)}.${ext}`;
    const base64 = trimmed.slice(match[0].length);
    const base64Encoding = (legacyFs.EncodingType?.Base64 ?? 'base64') as 'base64';
    await FileSystem.writeAsStringAsync(fileUri, base64, {
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
  if (!cachedUri) return { ...song, cover: undefined };
  return { ...song, cover: cachedUri };
};

export const sanitizeSongsForStorage = async (songs: Song[]): Promise<Song[]> => {
  const sanitized = await Promise.all(songs.map(sanitizeSongCover));
  return sanitized;
};
