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
export const MAX_SAF_FILES = 5000;
const ID3_WORKER_COUNT = 3;

const AUDIO_EXTENSIONS = new Set(['mp3', 'm4a', 'mp4', 'aac', 'flac', 'wav', 'ogg', 'opus', 'webm']);
const EXTENSION_MIME_MAP: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', webm: 'audio/webm' };

type MediaAsset = MediaLibrary.Asset;
type GetAssetsResult = MediaLibrary.PagedInfo<MediaAsset>;
type GetAssetsPage = (options: MediaLibrary.AssetsOptions) => Promise<GetAssetsResult>;

export interface AudioImportScanResult { assets: MediaAsset[]; skipped: Array<{ asset: MediaAsset; reason: string }>; }
export interface ImportScanResult { songs: Song[]; skipped: string[]; errors: string[]; sourceSummary: { source: 'media-library' | 'saf'; imported: number; skipped: number; errors: number }[]; folderUpdates?: ScanFolder[]; }

interface LoadAudioAssetsOptions { filterLikelyMusic?: boolean; }

export const deriveExtension = (input?: string): string | undefined => {
  if (!input) return undefined;
  const clean = input.split('?')[0] ?? input;
  const segment = clean.split('/').pop() ?? clean;
  const dot = segment.lastIndexOf('.');
  if (dot < 0 || dot === segment.length - 1) return undefined;
  return segment.slice(dot + 1).toLowerCase();
};
export const deriveMimeType = (rawMimeType: unknown, extension?: string): string | undefined => {
  if (typeof rawMimeType === 'string') {
    const n = rawMimeType.trim().toLowerCase();
    if (n.startsWith('audio/') && n.includes('/')) return n;
  }
  if (!extension) return undefined;
  return EXTENSION_MIME_MAP[extension];
};
export const isAudioFileUri = (uri: string): boolean => !!deriveExtension(uri) && AUDIO_EXTENSIONS.has(deriveExtension(uri) as string);
export const deriveFolderNameFromUri = (uri: string): string => {
  const cleaned = uri.replace(/\/+$/, '');
  const segment = decodeURIComponent((cleaned.split('/').pop() ?? '').replace(/%3A/gi, ':'));
  return segment || 'Ordner';
};

const filenameFromUri = (uri: string): string => {
  const raw = uri.split('/').pop() ?? uri;
  try { return decodeURIComponent(raw); } catch { return raw; }
};

const resolveAssetSize = async (uri: string, existing?: number): Promise<number | undefined> => {
  if (typeof existing === 'number' && existing > 0) return existing;
  try { const info = await getInfoAsync(uri); return info.exists && typeof info.size === 'number' && info.size > 0 ? info.size : undefined; } catch { return undefined; }
};

const buildSong = async (source: { id: string; uri: string; filename?: string; durationMs?: number; mimeType?: string; source: 'media-library' | 'saf'; size?: number }, tags: Id3Tags = {}): Promise<Song> => {
  const filename = source.filename ?? filenameFromUri(source.uri);
  const fallback = parseFilename(filename);
  const extension = deriveExtension(filename) ?? deriveExtension(source.uri);
  const coverCached = await cacheBase64Cover(source.id, tags.cover);
  const cover = coverCached ?? (tags.cover && !isBase64ImageDataUri(tags.cover) ? tags.cover : undefined);
  return {
    id: source.id,
    title: tags.title || fallback.title || filename.replace(/\.[^.]+$/, ''),
    artist: tags.artist || fallback.artist || 'Unbekannt',
    album: tags.album,
    uri: source.uri,
    cover,
    duration: source.durationMs,
    year: tags.year,
    genre: tags.genre,
    fileInfo: { filename, uri: source.uri, extension, container: extension, mimeType: deriveMimeType(source.mimeType, extension), size: await resolveAssetSize(source.uri, source.size), source: source.source, importedAt: Date.now() },
    coverInfo: { status: cover ? (coverCached ? 'cached' : 'external') : 'none', uri: cover },
  };
};

export const readAudioUrisFromSafDirectory = async (directoryUri: string, readDirectory: (uri: string) => Promise<string[]> = StorageAccessFramework.readDirectoryAsync): Promise<{ files: string[]; errors: string[] }> => {
  try { const entries = await readDirectory(directoryUri); return { files: entries.filter(isAudioFileUri).slice(0, MAX_SAF_FILES), errors: [] }; } catch { return { files: [], errors: [directoryUri] }; }
};

export const scanAudioAssetsFromMediaLibrary = async (getAssetsPage: GetAssetsPage = MediaLibrary.getAssetsAsync, options: LoadAudioAssetsOptions = {}): Promise<AudioImportScanResult> => {
  const { filterLikelyMusic = true } = options; const assets: MediaAsset[] = []; const skipped: Array<{ asset: MediaAsset; reason: string }> = []; const seenIds = new Set<string>();
  let after: string | undefined; let previousCursor: string | undefined; let pageCount = 0;
  while (pageCount < MAX_IMPORT_PAGES) { const page = await getAssetsPage({ mediaType: 'audio', first: PAGE_SIZE, ...(after ? { after } : {}) });
    for (const asset of page.assets) { if (seenIds.has(asset.id)) continue; seenIds.add(asset.id); if (filterLikelyMusic && !isLikelyMusicAsset(asset)) { skipped.push({ asset, reason: getAudioAssetRejectReason(asset) ?? 'not-likely-music' }); continue; } assets.push(asset); }
    pageCount += 1; if (!page.hasNextPage || !page.endCursor || page.endCursor === previousCursor) break; previousCursor = page.endCursor; after = page.endCursor; }
  return { assets, skipped };
};

export const scanFromMediaLibrary = async (): Promise<ImportScanResult> => {
  const scan = await scanAudioAssetsFromMediaLibrary(); const queue = [...scan.assets]; const songs: Song[] = []; const errors: string[] = [];
  const workers = Array.from({ length: ID3_WORKER_COUNT }, async () => { while (queue.length > 0) { const asset = queue.shift(); if (!asset) break; try { const tags = await parseId3FromUri(asset.uri).catch(() => ({})); songs.push(await buildSong({ id: asset.id, uri: asset.uri, filename: asset.filename, durationMs: (asset.duration ?? 0) * 1000, mimeType: (asset as { mimeType?: string }).mimeType, source: 'media-library', size: (asset as { fileSize?: number }).fileSize }, tags)); } catch { errors.push(asset.uri); } } });
  await Promise.all(workers); songs.sort((a, b) => a.title.localeCompare(b.title));
  return { songs, skipped: scan.skipped.map(s => `${s.asset.id}:${s.reason}`), errors, sourceSummary: [{ source: 'media-library', imported: songs.length, skipped: scan.skipped.length, errors: errors.length }] };
};

export const scanFromSafFolders = async (folders: ScanFolder[]): Promise<ImportScanResult> => {
  const songs: Song[] = []; const skipped: string[] = []; const errors: string[] = []; const folderUpdates: ScanFolder[] = [];
  for (const folder of folders) {
    if (!folder.enabled) { skipped.push(`${folder.name}:disabled`); folderUpdates.push(folder); continue; }
    const { files, errors: folderErrors } = await readAudioUrisFromSafDirectory(folder.uri);
    if (folderErrors.length > 0) { errors.push(...folderErrors); folderUpdates.push({ ...folder, lastError: 'Nicht lesbar' }); continue; }
    folderUpdates.push(folder.lastError ? { ...folder, lastError: undefined } : folder);
    for (const uri of files) {
      try { const tags = await parseId3FromUri(uri).catch(() => ({})); songs.push(await buildSong({ id: uri, uri, source: 'saf' }, tags)); }
      catch { errors.push(uri); songs.push(await buildSong({ id: uri, uri, source: 'saf' }, {})); }
    }
  }
  const uniqueSongs = Array.from(new Map(songs.map(song => [song.uri, song])).values()).filter((s): s is Song => !!s);
  uniqueSongs.sort((a, b) => a.title.localeCompare(b.title));
  return { songs: uniqueSongs, skipped, errors, sourceSummary: [{ source: 'saf', imported: uniqueSongs.length, skipped: skipped.length, errors: errors.length }], folderUpdates };
};

export const loadAllAudioAssetsFromMediaLibrary = async (getAssetsPage: GetAssetsPage = MediaLibrary.getAssetsAsync, options: LoadAudioAssetsOptions = {}): Promise<MediaAsset[]> => (await scanAudioAssetsFromMediaLibrary(getAssetsPage, options)).assets;
