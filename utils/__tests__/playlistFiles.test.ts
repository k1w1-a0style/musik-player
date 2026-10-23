import { getDocumentAsync } from 'expo-document-picker';
import { StorageAccessFramework as SAF, readAsStringAsync } from 'expo-file-system/legacy';
import { pickPlaylistFile, verifyPlaylistSources, writePlaylistFile } from '../playlistFiles';
import { serializeM3u8 } from '../m3uPlaylist';
import type { Song } from '../../types/Song';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { UTF8: 'utf8', Base64: 'base64' }, readAsStringAsync: jest.fn(),
  StorageAccessFramework: { requestDirectoryPermissionsAsync: jest.fn(), createFileAsync: jest.fn(),
    readAsStringAsync: jest.fn(), writeAsStringAsync: jest.fn(), deleteAsync: jest.fn() },
}));
const saf = SAF as jest.Mocked<typeof SAF>;
const pick = getDocumentAsync as jest.Mock;
const read = readAsStringAsync as jest.Mock;
const songs: Song[] = [{ id: '1', title: 'Ä', artist: 'Kiwi', uri: 'content://audio/1', duration: 15 }];
beforeEach(() => {
  jest.resetAllMocks();
  pick.mockResolvedValue({ canceled: false, assets: [{ name: 'Mix.m3u8', uri: 'content://playlist/1' }] });
  saf.readAsStringAsync.mockResolvedValue(serializeM3u8(songs));
  saf.requestDirectoryPermissionsAsync.mockResolvedValue({ granted: true, directoryUri: 'content://chosen' });
  saf.createFileAsync.mockResolvedValue('content://new-export');
  saf.writeAsStringAsync.mockResolvedValue(undefined);
  saf.deleteAsync.mockResolvedValue(undefined);
  read.mockResolvedValue('YQ==');
});
afterEach(() => jest.useRealTimers());
test('system file picker retains original URI for relative resolution and bounds the native text read', async () => {
  await expect(pickPlaylistFile(songs)).resolves.toMatchObject({ name: 'Mix', songs, unresolved: [] });
  expect(pick).toHaveBeenCalledWith({ type: '*/*', multiple: false, copyToCacheDirectory: false });
  expect(saf.readAsStringAsync).toHaveBeenCalledWith('content://playlist/1', { encoding: 'utf8', position: 0, length: 6291457 });
});
test('picker cancellation, wrong extensions and false provider sizes never create playlists or read oversized input', async () => {
  pick.mockResolvedValueOnce({ canceled: true });
  await expect(pickPlaylistFile(songs)).resolves.toBeNull();
  for (const asset of [{ name: 'x.mp3' }, { name: 'x.m3u', size: 7_000_000 }]) {
    pick.mockResolvedValueOnce({ canceled: false, assets: [asset] });
    await expect(pickPlaylistFile(songs)).rejects.toThrow();
  }
  expect(saf.readAsStringAsync).not.toHaveBeenCalled();
});
test('revoked playlist access propagates visibly and never mutates the existing library', async () => {
  const before = JSON.stringify(songs);
  saf.readAsStringAsync.mockRejectedValueOnce(new Error('permission revoked'));
  await expect(pickPlaylistFile(songs)).rejects.toThrow('permission revoked');
  expect(JSON.stringify(songs)).toBe(before);
});
test('cancel during delayed picker ignores returned contents', async () => {
  const controller = new AbortController();
  let finish!: (value: unknown) => void;
  pick.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const pending = pickPlaylistFile(songs, controller.signal);
  controller.abort();
  finish({ canceled: false, assets: [{ name: 'x.m3u8', uri: 'content://delayed' }] });
  await expect(pending).rejects.toThrow();
  expect(saf.readAsStringAsync).not.toHaveBeenCalled();
});
test('each candidate receives a one-byte read; revoked and empty documents are excluded in stable order', async () => {
  const candidates = [...songs, { ...songs[0], id: '2', uri: 'file:///empty.mp3' }, { ...songs[0], id: '3', uri: 'content://revoked/3' }];
  read.mockResolvedValueOnce('YQ==').mockResolvedValueOnce('').mockRejectedValueOnce(new Error('SecurityException'));
  await expect(verifyPlaylistSources(candidates)).resolves.toEqual({ readable: songs, unreadable: candidates.slice(1) });
  expect(read).toHaveBeenCalledWith('content://audio/1', { encoding: 'base64', position: 0, length: 1 });
});
test('bounded concurrency stays at four native reads, abort schedules no later batch', async () => {
  const controller = new AbortController();
  const releases: Array<() => void> = [];
  read.mockImplementation(() => new Promise(resolve => releases.push(() => resolve('YQ=='))));
  const pending = verifyPlaylistSources(Array.from({ length: 100 }, (_, i) => ({ ...songs[0], id: String(i) })), controller.signal);
  expect(read).toHaveBeenCalledTimes(4);
  controller.abort(); releases.forEach(finish => finish());
  await expect(pending).rejects.toThrow();
  expect(read).toHaveBeenCalledTimes(4);
});
test('a stalled provider fails rather than accumulating more timed-out reads', async () => {
  jest.useFakeTimers(); read.mockReturnValue(new Promise(() => undefined));
  const pending = verifyPlaylistSources(Array.from({ length: 100 }, (_, i) => ({ ...songs[0], id: String(i) })));
  const assertion = expect(pending).rejects.toThrow('antwortet nicht');
  await jest.advanceTimersByTimeAsync(5000); await assertion;
  expect(read).toHaveBeenCalledTimes(4);
});
test('M3U8 export creates a new file in the chosen destination, verifies exact roundtrip, never writes audio', async () => {
  await expect(writePlaylistFile('Road/trip', songs)).resolves.toBe('content://new-export');
  expect(saf.createFileAsync).toHaveBeenCalledWith('content://chosen', 'Road_trip.m3u8', 'audio/x-mpegurl');
  expect(saf.writeAsStringAsync).toHaveBeenCalledWith('content://new-export', serializeM3u8(songs), { encoding: 'utf8' });
  expect(saf.deleteAsync).not.toHaveBeenCalled();
});
test('cancelling destination selection writes nothing', async () => {
  saf.requestDirectoryPermissionsAsync.mockResolvedValueOnce({ granted: false });
  await expect(writePlaylistFile('Mix', songs)).resolves.toBeNull();
  expect(saf.createFileAsync).not.toHaveBeenCalled();
});
test.each(['full', 'revoked', 'truncated'])('failed export %s never succeeds and cleans only the new document', async reason => {
  if (reason === 'truncated') saf.readAsStringAsync.mockResolvedValueOnce('#EXTM3U');
  else saf.writeAsStringAsync.mockRejectedValueOnce(new Error(reason));
  await expect(writePlaylistFile('Mix', songs)).rejects.toThrow();
  await Promise.resolve();
  expect(saf.deleteAsync).toHaveBeenCalledWith('content://new-export', { idempotent: true });
});
test('write timeout never races cleanup against a still-running provider write', async () => {
  jest.useFakeTimers();
  let finish!: () => void;
  saf.writeAsStringAsync.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const assertion = expect(writePlaylistFile('Mix', songs)).rejects.toThrow('rechtzeitig gespeichert');
  await jest.advanceTimersByTimeAsync(15000); await assertion;
  expect(saf.deleteAsync).not.toHaveBeenCalled();
  finish(); await Promise.resolve(); await Promise.resolve();
  expect(saf.deleteAsync).toHaveBeenCalledWith('content://new-export', { idempotent: true });
});
