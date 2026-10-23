import { getDocumentAsync } from 'expo-document-picker';
import { StorageAccessFramework as SAF, EncodingType, readAsStringAsync } from 'expo-file-system/legacy';
import type { Song } from '../types/Song';
import { MAX_M3U_CODE_UNITS, parseM3u, resolveM3u, serializeM3u8, songPlaylistUri, type M3uResolution } from './m3uPlaylist';
import { isTimeoutError, throwIfAborted, withTimeout } from './withTimeout';

export interface PlaylistImportPreview extends M3uResolution { name: string }
const textReadOptions = () => ({ encoding: EncodingType.UTF8, position: 0, length: MAX_M3U_CODE_UNITS * 3 + 1 });
class PlaylistReadCapacityError extends Error {}
let pendingSourceReads = 0;
const readSourceByte = async (uri: string, signal?: AbortSignal): Promise<string> => {
  if (pendingSourceReads >= 4) throw new PlaylistReadCapacityError('Der Dateianbieter bearbeitet noch frühere Leseanfragen. Bitte warte einen Moment.');
  pendingSourceReads += 1;
  // Keep capacity until the real native read settles, including after timeout
  // or cancellation. Retrying must not accumulate unbounded provider calls.
  const reading = Promise.resolve().then(() => readAsStringAsync(uri, {
    encoding: EncodingType.Base64, position: 0, length: 1,
  })).finally(() => { pendingSourceReads -= 1; });
  return withTimeout(reading, 5_000, 'Die Audiodatei antwortet nicht.', { signal });
};

export const pickPlaylistFile = async (library: Song[], signal?: AbortSignal): Promise<PlaylistImportPreview | null> => {
  throwIfAborted(signal);
  // Some providers label .m3u as text/plain or application/octet-stream.
  // Select any document, then enforce the filename, content and size locally.
  const selected = await getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: false });
  throwIfAborted(signal);
  if (selected.canceled) return null;
  const asset = selected.assets[0];
  if (!asset || !/\.m3u8?$/i.test(asset.name)) throw new Error('Bitte wähle eine M3U- oder M3U8-Datei.');
  if (asset.size !== undefined && asset.size > (MAX_M3U_CODE_UNITS * 3 + 1) - 1) {
    throw new Error('Die Playlist-Datei ist zu groß.');
  }
  const raw = await withTimeout(SAF.readAsStringAsync(asset.uri, textReadOptions()), 15_000,
    'Die Playlist konnte nicht rechtzeitig gelesen werden.', { signal });
  throwIfAborted(signal);
  return { ...resolveM3u(parseM3u(raw), library, asset.uri), name: asset.name.replace(/\.m3u8?$/i, '') || 'Importierte Playlist' };
};

export const verifyPlaylistSources = async (songs: Song[], signal?: AbortSignal,
  onProgress?: (done: number, total: number) => void): Promise<{ readable: Song[]; unreadable: Song[] }> => {
  let cursor = 0;
  let done = 0;
  let stopped = false;
  const accepted = new Set<string>();
  const worker = async () => {
    while (cursor < songs.length) {
      throwIfAborted(signal);
      if (stopped) return;
      const song = songs[cursor++];
      const uri = songPlaylistUri(song);
      try {
        if (uri) {
          // A real bounded read checks current access; a stored grant/stat alone
          // does not prove that a SAF provider can still open this document.
          const firstByte = await readSourceByte(uri, signal);
          if (firstByte) accepted.add(song.id);
        }
      } catch (error) {
        throwIfAborted(signal);
        // Do not accumulate timed-out provider reads in further batches.
        if (isTimeoutError(error) || error instanceof PlaylistReadCapacityError) throw error;
      }
      throwIfAborted(signal);
      if (stopped) return;
      done += 1;
      onProgress?.(done, songs.length);
    }
  };
  try { await Promise.all(Array.from({ length: Math.min(4, songs.length) }, worker)); }
  finally { stopped = true; }
  return { readable: songs.filter(song => accepted.has(song.id)), unreadable: songs.filter(song => !accepted.has(song.id)) };
};

export const writePlaylistFile = async (name: string, songs: Song[]): Promise<string | null> => {
  const raw = serializeM3u8(songs);
  const permission = await SAF.requestDirectoryPermissionsAsync();
  if (!permission.granted) return null;
  const safeName = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 100) || 'Playlist';
  const uri = await SAF.createFileAsync(permission.directoryUri, `${safeName}.m3u8`, 'audio/x-mpegurl');
  const writing = SAF.writeAsStringAsync(uri, raw, { encoding: EncodingType.UTF8 });
  try {
    await withTimeout(writing, 15_000,
      'Die Playlist konnte nicht rechtzeitig gespeichert werden.');
    const confirmed = await withTimeout(SAF.readAsStringAsync(uri, textReadOptions()), 15_000,
      'Die gespeicherte Playlist konnte nicht bestätigt werden.');
    if (confirmed !== raw) throw new Error('Die exportierte Playlist wurde nicht vollständig gespeichert.');
    return uri;
  } catch (error) {
    // Only the newly created document is cleaned up; original music is never written.
    // A deadline cannot cancel a provider write. Wait for its actual settlement
    // before cleanup, without blocking the caller or racing deletion with writes.
    void writing.then(() => SAF.deleteAsync(uri, { idempotent: true }),
      () => SAF.deleteAsync(uri, { idempotent: true })).catch(() => undefined);
    throw error;
  }
};
