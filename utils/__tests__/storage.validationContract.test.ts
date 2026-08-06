import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage, StorageKeys } from '../storage';

const VALIDATION_CASES = [
  {
    key: StorageKeys.SONGS,
    input: [
      { id: 's1', title: 'Song', artist: 'Artist' },
      { title: 'Broken' },
    ],
    expected: [{ id: 's1', title: 'Song', artist: 'Artist' }],
  },
  {
    key: StorageKeys.PLAYLISTS,
    input: [
      { id: 'p1', name: 'List', songIds: ['s1'], createdAt: 1, updatedAt: 2 },
      { id: 'broken' },
    ],
    expected: [{ id: 'p1', name: 'List', songIds: ['s1'], createdAt: 1, updatedAt: 2 }],
  },
  { key: StorageKeys.CURRENT_SONG_ID, input: ' song-1 ', expected: 'song-1' },
  { key: StorageKeys.EQ_PRESET, input: 'custom', expected: 'custom' },
  {
    key: StorageKeys.EQ_BANDS,
    input: [-20, -12, -6, 0, 1, 2, 3, 4, 12, 20],
    expected: [-12, -12, -6, 0, 1, 2, 3, 4, 12, 12],
  },
  { key: StorageKeys.EQ_ENABLED, input: 'true', expected: true },
  { key: StorageKeys.VOLUME, input: '1.25', expected: 1 },
  { key: StorageKeys.REPEAT_MODE, input: 'all', expected: 'all' },
  { key: StorageKeys.SHUFFLE, input: 'false', expected: false },
  {
    key: StorageKeys.SCAN_FOLDERS,
    input: [
      { id: 'f1', name: 'Music', uri: 'content://music', addedAt: 10 },
      { id: 'broken' },
    ],
    expected: [
      { id: 'f1', name: 'Music', uri: 'content://music', addedAt: 10, enabled: true },
    ],
  },
  {
    key: StorageKeys.FAVORITE_SONG_IDS,
    input: [' s1 ', '', 's1', 's2'],
    expected: ['s1', 's2'],
  },
  {
    key: StorageKeys.LEGACY_SONG_FAVORITES_MIGRATION_COMPLETED,
    input: 'true',
    expected: true,
  },
  { key: StorageKeys.LIBRARY_SORT_MODE, input: 'year', expected: 'year' },
  { key: StorageKeys.LIBRARY_SONG_VIEW_MODE, input: 'gridSmall', expected: 'gridSmall' },
  { key: StorageKeys.ALBUM_VIEW_MODE, input: 'list', expected: 'list' },
  { key: StorageKeys.APP_APPEARANCE, input: 'light', expected: 'light' },
  { key: StorageKeys.APP_THEME_SKIN, input: 'minimal', expected: 'minimal' },
] as const;

const PROTOTYPE_LIKE_CUSTOM_KEYS = ['toString', 'constructor', '__proto__'] as const;

describe('storage validation dispatch contract', () => {
  beforeEach(() => {
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
  });

  test('covers every declared storage key exactly once', () => {
    const coveredKeys = VALIDATION_CASES.map(({ key }) => key);

    expect(new Set(coveredKeys).size).toBe(coveredKeys.length);
    expect(new Set(coveredKeys)).toEqual(new Set(Object.values(StorageKeys)));
  });

  test.each(VALIDATION_CASES)('normalizes $key without changing its contract', async ({ key, input, expected }) => {
    await expect(storage.set(key, input)).resolves.toBe(true);
    await expect(storage.get(key)).resolves.toEqual(expected);
  });

  test('keeps unknown custom keys untouched', async () => {
    const value = { nested: { keep: true }, list: [1, '2', null] };

    await expect(storage.set('customKey', value)).resolves.toBe(true);
    await expect(storage.get('customKey')).resolves.toEqual(value);
  });

  test.each(PROTOTYPE_LIKE_CUSTOM_KEYS)(
    'does not treat prototype-like custom key %s as a validator',
    async key => {
      const value = { key, nested: { keep: true } };

      await expect(storage.set(key, value)).resolves.toBe(true);
      await expect(storage.get(key)).resolves.toEqual(value);
    },
  );
});
