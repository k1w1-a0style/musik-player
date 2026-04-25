import { storage, StorageKeys } from '../storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('storage', () => {
  beforeEach(() => {
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
  });

  test('round-trips JSON-serialisable values', async () => {
    await storage.set(StorageKeys.VOLUME, 0.42);
    expect(await storage.get<number>(StorageKeys.VOLUME)).toBe(0.42);
  });

  test('round-trips arrays and objects', async () => {
    const data = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];
    await storage.set('list', data);
    expect(await storage.get('list')).toEqual(data);
  });

  test('returns null for missing keys', async () => {
    expect(await storage.get('does-not-exist')).toBeNull();
  });

  test('remove deletes a key', async () => {
    await storage.set('temp', { v: 1 });
    await storage.remove('temp');
    expect(await storage.get('temp')).toBeNull();
  });

  test('prefixes all keys with @musikplayer:', async () => {
    await storage.set('foo', 'bar');
    const internal = (AsyncStorage as unknown as { __getStore: () => Map<string, string> }).__getStore();
    expect(internal.has('@musikplayer:foo')).toBe(true);
  });

  test('returns null on JSON parse failure (resilient)', async () => {
    await AsyncStorage.setItem('@musikplayer:bad', '{not-json');
    expect(await storage.get('bad')).toBeNull();
  });
});
