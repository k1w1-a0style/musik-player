import {
  addScanFolder,
  clearScanFolders,
  getFavoriteSongIds,
  getScanFolders,
  removeScanFolder,
  setFavoriteSongId,
  storage,
  StorageKeys,
  updateScanFolder,
} from '../storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('storage', () => {
  beforeEach(() => {
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
    jest.restoreAllMocks();
  });

  test('round-trips JSON-serialisable values', async () => {
    await storage.set(StorageKeys.VOLUME, 0.42);
    expect(await storage.get<number>(StorageKeys.VOLUME)).toBe(0.42);
  });

  test('returns null on JSON parse failure (resilient)', async () => {
    await AsyncStorage.setItem('@musikplayer:bad', '{not-json');
    expect(await storage.get('bad')).toBeNull();
  });

  test('scan folders persist and reload', async () => {
    await addScanFolder({ id: '1', name: 'Music', uri: 'content://music', addedAt: 1, enabled: true });
    expect(await getScanFolders()).toEqual([{ id: '1', name: 'Music', uri: 'content://music', addedAt: 1, enabled: true }]);
  });

  test('scan folders ignore duplicate uris', async () => {
    await addScanFolder({ id: '1', name: 'Music', uri: 'content://music', addedAt: 1, enabled: true });
    await addScanFolder({ id: '2', name: 'Music Duplicate', uri: 'content://music', addedAt: 2, enabled: true });

    expect(await getScanFolders()).toEqual([{ id: '1', name: 'Music', uri: 'content://music', addedAt: 1, enabled: true }]);
  });

  test('scan folders ignore malformed data', async () => {
    await storage.set(StorageKeys.SCAN_FOLDERS, [{ bad: true }, { id: '1', name: 'x', uri: 'u', addedAt: 0, enabled: false }]);
    expect(await getScanFolders()).toEqual([{ id: '1', name: 'x', uri: 'u', addedAt: 0, enabled: false }]);
  });

  test('remove and toggle scan folder', async () => {
    await storage.set(StorageKeys.SCAN_FOLDERS, [{ id: '1', name: 'x', uri: 'u', addedAt: 0, enabled: true }]);
    await updateScanFolder('1', { enabled: false });
    expect((await getScanFolders())[0]?.enabled).toBe(false);
    await removeScanFolder('1');
    expect(await getScanFolders()).toEqual([]);
    await clearScanFolders();
  });

  test('updateScanFolder preserves folder id even if patch contains id', async () => {
    await storage.set(StorageKeys.SCAN_FOLDERS, [{ id: '1', name: 'x', uri: 'u', addedAt: 0, enabled: true }]);
    await updateScanFolder('1', { id: 'changed', name: 'Renamed' });

    expect(await getScanFolders()).toEqual([{ id: '1', name: 'Renamed', uri: 'u', addedAt: 0, enabled: true }]);
  });

  test('filters invalid favorite ids', async () => {
    await storage.set(StorageKeys.FAVORITE_SONG_IDS, ['s1', 2, 's2', null]);
    expect(await getFavoriteSongIds()).toEqual(['s1', 's2']);
  });

  test('setFavoriteSongId surfaces persistence failures', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));

    await expect(setFavoriteSongId('s1', true)).rejects.toThrow('Failed to persist favorite song ids');
  });

  test('rejects invalid persisted settings', async () => {
    await storage.set(StorageKeys.VOLUME, 2);
    await storage.set(StorageKeys.REPEAT_MODE, 'sometimes');
    await storage.set(StorageKeys.SHUFFLE, 'yes');

    expect(await storage.get<number>(StorageKeys.VOLUME)).toBeNull();
    expect(await storage.get<string>(StorageKeys.REPEAT_MODE)).toBeNull();
    expect(await storage.get<boolean>(StorageKeys.SHUFFLE)).toBeNull();
  });

  test('rejects eq band arrays with invalid values or unexpected length', async () => {
    await storage.set(StorageKeys.EQ_BANDS, [1, 2, 3]);
    expect(await storage.get<number[]>(StorageKeys.EQ_BANDS)).toBeNull();

    await storage.set(StorageKeys.EQ_BANDS, [1, 2, 3, 4, 5, 6, 7, 'invalid', 9, 10]);
    expect(await storage.get<number[]>(StorageKeys.EQ_BANDS)).toBeNull();

    await storage.set(StorageKeys.EQ_BANDS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(await storage.get<number[]>(StorageKeys.EQ_BANDS)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('filters invalid songs and playlists', async () => {
    const song = { id: 's1', title: 'Song', artist: 'Artist' };
    const playlist = { id: 'pl-1', name: 'Roadtrip', songIds: ['s1'], createdAt: 1 };

    await storage.set(StorageKeys.SONGS, [song, { title: 'Broken' }]);
    await storage.set(StorageKeys.PLAYLISTS, [playlist, { id: 'pl-2', name: 'Broken', songIds: [1], createdAt: 1 }]);

    expect(await storage.get(StorageKeys.SONGS)).toEqual([song]);
    expect(await storage.get(StorageKeys.PLAYLISTS)).toEqual([playlist]);
  });
});