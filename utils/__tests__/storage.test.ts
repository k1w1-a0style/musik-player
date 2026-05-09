import {
  addScanFolder,
  clearScanFolders,
  getScanFolders,
  removeScanFolder,
  storage,
  StorageKeys,
  updateScanFolder,
} from '../storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('storage', () => {
  beforeEach(() => {
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
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
});
