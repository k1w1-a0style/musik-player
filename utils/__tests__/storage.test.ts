import {
  addScanFolder,
  clearScanFolders,
  getFavoriteSongIds,
  getScanFolders,
  isFavoriteSongId,
  normalizeEqBandsForStorage,
  normalizeFavoriteSongIds,
  normalizeStorageSongId,
  normalizeVolumeForStorage,
  migrateLegacySongFavoritesFromStoredSongs,
  removeScanFolder,
  setFavoriteSongId,
  storage,
  StorageKeys,
  updateScanFolder,
} from '../storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('storage', () => {
  const assertCurrentSongIdRaw = async (raw: string, expected: string | null) => {
    await AsyncStorage.setItem('@musikplayer:currentSongId', raw);

    await expect(storage.getCurrentSongId()).resolves.toBe(expected);
    await expect(storage.get<string>(StorageKeys.CURRENT_SONG_ID)).resolves.toBe(expected);
  };

  beforeEach(() => {
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
    jest.restoreAllMocks();
  });

  test('round-trips JSON-serialisable values', async () => {
    await storage.set(StorageKeys.VOLUME, 0.42);
    expect(await storage.get<number>(StorageKeys.VOLUME)).toBe(0.42);
  });

  test('normalizes writes for valid storage keys', async () => {
    const song = { id: 's1', title: 'Song', artist: 'Artist', uri: 'file://song.mp3', artwork: '' };

    await storage.set(StorageKeys.SONGS, [song, { title: 'Broken' }]);

    await expect(storage.get(StorageKeys.SONGS)).resolves.toEqual([song]);
  });

  test('keeps unknown keys as-is on write', async () => {
    const value = { nested: { keep: true }, list: [1, '2', null] };

    await expect(storage.set('customKey', value)).resolves.toBe(true);
    await expect(storage.get('customKey')).resolves.toEqual(value);
  });

  test('normalizes StorageKeys.FAVORITE_SONG_IDS but keeps FAVORITE_SONG_IDS as unknown key', async () => {
    await expect(storage.set(StorageKeys.FAVORITE_SONG_IDS, [' s1 ', '', 's1'])).resolves.toBe(true);
    await expect(storage.get(StorageKeys.FAVORITE_SONG_IDS)).resolves.toEqual(['s1']);

    await expect(storage.set('FAVORITE_SONG_IDS', [' s1 ', '', 's1'])).resolves.toBe(true);
    await expect(storage.get('FAVORITE_SONG_IDS')).resolves.toEqual([' s1 ', '', 's1']);
  });

  test('does not treat storage key constant names as storage keys', async () => {
    await expect(storage.set('SONGS', [{ title: 'Broken' }])).resolves.toBe(true);
    await expect(storage.get('SONGS')).resolves.toEqual([{ title: 'Broken' }]);
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

  test('getScanFolders normalizes legacy folder entries without enabled', async () => {
    await storage.set(StorageKeys.SCAN_FOLDERS, [{ id: '1', name: 'Legacy', uri: 'content://legacy', addedAt: 10 }]);

    await expect(getScanFolders()).resolves.toEqual([
      { id: '1', name: 'Legacy', uri: 'content://legacy', addedAt: 10, enabled: true },
    ]);
  });

  test('setScanFolders persists normalized entries and keeps passthrough fields', async () => {
    await storage.setScanFolders([
      { id: '1', name: 'Legacy', uri: 'content://legacy', addedAt: 10 },
      { id: '2', name: 'WithMeta', uri: 'content://meta', addedAt: 11, enabled: false, source: 'import' },
      { id: 3, name: 'Bad', uri: 'content://bad', addedAt: 12, enabled: true },
    ]);

    await expect(getScanFolders()).resolves.toEqual([
      { id: '1', name: 'Legacy', uri: 'content://legacy', addedAt: 10, enabled: true },
      { id: '2', name: 'WithMeta', uri: 'content://meta', addedAt: 11, enabled: false, source: 'import' },
    ]);
  });

  test('getScanFolders returns empty list for broken JSON', async () => {
    await AsyncStorage.setItem('@musikplayer:scanFolders', '{broken-json');
    await expect(getScanFolders()).resolves.toEqual([]);
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

  test('removeScanFolder does not persist when id is missing', async () => {
    const existing = [{ id: '1', name: 'x', uri: 'u', addedAt: 0, enabled: true }];
    await storage.set(StorageKeys.SCAN_FOLDERS, existing);
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await expect(removeScanFolder('missing')).resolves.toEqual(existing);
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  test('updateScanFolder does not persist when id is missing', async () => {
    const existing = [{ id: '1', name: 'x', uri: 'u', addedAt: 0, enabled: true }];
    await storage.set(StorageKeys.SCAN_FOLDERS, existing);
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await expect(updateScanFolder('missing', { name: 'Nope' })).resolves.toEqual(existing);
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  test('updateScanFolder does not persist effective no-op patch', async () => {
    const existing = [{ id: '1', name: 'x', uri: 'u', addedAt: 0, enabled: true }];
    await storage.set(StorageKeys.SCAN_FOLDERS, existing);
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await expect(updateScanFolder('1', { id: 'changed' })).resolves.toEqual(existing);
    expect(await getScanFolders()).toEqual(existing);
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  test('normalizes storage song ids', () => {
    expect(normalizeStorageSongId(' s1 ')).toBe('s1');
    expect(normalizeStorageSongId('')).toBeUndefined();
    expect(normalizeStorageSongId('   ')).toBeUndefined();
    expect(normalizeStorageSongId(123)).toBeUndefined();
  });

  test('normalizes favorite ids', () => {
    expect(normalizeFavoriteSongIds(['s1', ' s2 ', '', 's1', 2, null, 's2'])).toEqual(['s1', 's2']);
  });

  test('filters invalid favorite ids and removes duplicates', async () => {
    await storage.set(StorageKeys.FAVORITE_SONG_IDS, ['s1', 2, 's2', null, 's1', ' s2 ', '']);
    expect(await getFavoriteSongIds()).toEqual(['s1', 's2']);
  });

  test('getFavoriteSongIds returns [] for missing value', async () => {
    await expect(storage.getFavoriteSongIds()).resolves.toEqual([]);
  });

  test('getFavoriteSongIds returns [] for broken json value', async () => {
    await AsyncStorage.setItem('@musikplayer:favoriteSongIds', '{broken-json');
    await expect(storage.getFavoriteSongIds()).resolves.toEqual([]);
  });

  test('getFavoriteSongIds returns [] for non-array json value', async () => {
    await AsyncStorage.setItem('@musikplayer:favoriteSongIds', JSON.stringify({ ids: ['s1'] }));
    await expect(storage.getFavoriteSongIds()).resolves.toEqual([]);
  });

  test('storage.get and getFavoriteSongIds stay consistent for valid arrays', async () => {
    await AsyncStorage.setItem('@musikplayer:favoriteSongIds', JSON.stringify([' s1 ', '', 's2', 's1', '   ']));
    await expect(storage.get(StorageKeys.FAVORITE_SONG_IDS)).resolves.toEqual(['s1', 's2']);
    await expect(storage.getFavoriteSongIds()).resolves.toEqual(['s1', 's2']);
  });

  test('isFavoriteSongId normalizes lookup ids', async () => {
    await storage.set(StorageKeys.FAVORITE_SONG_IDS, ['s1']);

    await expect(isFavoriteSongId(' s1 ')).resolves.toBe(true);
    await expect(isFavoriteSongId('   ')).resolves.toBe(false);
  });

  test('setFavoriteSongId trims ids, dedupes additions and ignores empty ids', async () => {
    await storage.set(StorageKeys.FAVORITE_SONG_IDS, ['s1']);

    await expect(setFavoriteSongId(' s2 ', true)).resolves.toEqual(['s1', 's2']);
    await expect(setFavoriteSongId('s2', true)).resolves.toEqual(['s1', 's2']);
    await expect(setFavoriteSongId(' ', true)).resolves.toEqual(['s1', 's2']);
    await expect(setFavoriteSongId(' s1 ', false)).resolves.toEqual(['s2']);
  });

  test('setFavoriteSongId does not persist no-op additions', async () => {
    const existing = ['s1'];
    await storage.set(StorageKeys.FAVORITE_SONG_IDS, existing);
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await expect(setFavoriteSongId('s1', true)).resolves.toEqual(existing);
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  test('setFavoriteSongId does not persist no-op removals', async () => {
    const existing = ['s1'];
    await storage.set(StorageKeys.FAVORITE_SONG_IDS, existing);
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await expect(setFavoriteSongId('missing', false)).resolves.toEqual(existing);
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  test('setFavoriteSongId surfaces persistence failures', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));

    await expect(setFavoriteSongId('s1', true)).rejects.toThrow('Failed to persist favorite song ids');
  });

  test('normalizes current song ids for generic and typed storage access', async () => {
    await storage.setCurrentSongId(' s1 ');
    expect(await storage.getCurrentSongId()).toBe('s1');
    expect(await storage.get<string>(StorageKeys.CURRENT_SONG_ID)).toBe('s1');

    await storage.set(StorageKeys.CURRENT_SONG_ID, ' s2 ');
    expect(await storage.getCurrentSongId()).toBe('s2');

    await storage.setCurrentSongId('   ');
    expect(await storage.getCurrentSongId()).toBeNull();
  });

  test('setCurrentSongId avoids no-op set operations', async () => {
    await storage.setCurrentSongId('s1');

    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await storage.setCurrentSongId(' s1 ');

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(await storage.getCurrentSongId()).toBe('s1');
  });

  test('setCurrentSongId avoids no-op remove operations', async () => {
    await AsyncStorage.removeItem('@musikplayer:currentSongId');

    const removeItemSpy = jest.spyOn(AsyncStorage, 'removeItem').mockClear();

    await storage.setCurrentSongId('   ');

    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(await storage.getCurrentSongId()).toBeNull();
  });
  test('setCurrentSongId writes valid id even when no-op guard read fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read failed'));
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await expect(storage.setCurrentSongId('s1')).resolves.toBeUndefined();

    expect(setItemSpy).toHaveBeenCalledWith('@musikplayer:currentSongId', 's1');
  });

  test('setCurrentSongId removes value even when no-op guard read fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read failed'));
    const removeItemSpy = jest.spyOn(AsyncStorage, 'removeItem').mockClear();

    await expect(storage.setCurrentSongId('   ')).resolves.toBeUndefined();

    expect(removeItemSpy).toHaveBeenCalledWith('@musikplayer:currentSongId');
  });

  test('keeps raw and JSON string settings compatible', async () => {
    await storage.setCurrentSongId('s1');
    expect(await storage.get<string>(StorageKeys.CURRENT_SONG_ID)).toBe('s1');
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's2');
    expect(await storage.getCurrentSongId()).toBe('s2');

    await storage.setEqPreset('rock');
    expect(await storage.get<string>(StorageKeys.EQ_PRESET)).toBe('rock');
    await storage.set(StorageKeys.EQ_PRESET, 'jazz');
    expect(await storage.getEqPreset()).toBe('jazz');

    await storage.setRepeatMode('one');
    expect(await storage.get<string>(StorageKeys.REPEAT_MODE)).toBe('one');
    await storage.set(StorageKeys.REPEAT_MODE, 'all');
    expect(await storage.getRepeatMode()).toBe('all');
  });

  test('accepts raw numeric-looking current song ids from direct storage writes', async () => {
    await assertCurrentSongIdRaw('123', '123');
  });

  test('accepts raw boolean-looking current song ids from direct storage writes', async () => {
    await assertCurrentSongIdRaw('true', 'true');
    await assertCurrentSongIdRaw('false', 'false');
  });

  test('rejects raw "null" current song id from direct storage writes', async () => {
    await assertCurrentSongIdRaw('null', null);
  });

  test('accepts JSON-encoded current song id strings', async () => {
    await assertCurrentSongIdRaw('"123"', '123');
  });

  test('rejects JSON-encoded blank current song id strings', async () => {
    await assertCurrentSongIdRaw('""', null);
    await assertCurrentSongIdRaw('"   "', null);
  });

  test('accepts raw eq preset and repeat mode values that JSON.parse into invalid primitives', async () => {
    await AsyncStorage.setItem('@musikplayer:eqPreset', '0');
    await AsyncStorage.setItem('@musikplayer:repeatMode', '1');

    await expect(storage.getEqPreset()).resolves.toBe('flat');
    await expect(storage.get<string>(StorageKeys.EQ_PRESET)).resolves.toBeNull();
    await expect(storage.getRepeatMode()).resolves.toBe('off');
    await expect(storage.get<string>(StorageKeys.REPEAT_MODE)).resolves.toBeNull();
  });

  test('keeps unsupported keys null when stored JSON parses into invalid values', async () => {
    await AsyncStorage.setItem('@musikplayer:volume', '"loud"');

    await expect(storage.get<number>(StorageKeys.VOLUME)).resolves.toBeNull();
  });

  test('persists and restores custom eq preset', async () => {
    await expect(storage.setEqPreset('custom')).resolves.toBeUndefined();
    await expect(storage.getEqPreset()).resolves.toBe('custom');
    await expect(storage.set(StorageKeys.EQ_PRESET, 'custom')).resolves.toBe(true);
    await expect(storage.get<string>(StorageKeys.EQ_PRESET)).resolves.toBe('custom');
  });

  test('continues to accept standard eq preset names', async () => {
    await expect(storage.setEqPreset('flat')).resolves.toBeUndefined();
    await expect(storage.getEqPreset()).resolves.toBe('flat');
    await expect(storage.set(StorageKeys.EQ_PRESET, 'flat')).resolves.toBe(true);
    await expect(storage.get<string>(StorageKeys.EQ_PRESET)).resolves.toBe('flat');
  });

  test('setEqPreset avoids identical raw writes', async () => {
    await storage.setEqPreset('custom');
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await storage.setEqPreset('custom');

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(await storage.getEqPreset()).toBe('custom');
  });

  test('setEqPreset still overwrites invalid stored raw values', async () => {
    await AsyncStorage.setItem('@musikplayer:eqPreset', 'invalid');
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await storage.setEqPreset('flat');

    expect(setItemSpy).toHaveBeenCalled();
    expect(await storage.getEqPreset()).toBe('flat');
  });
  test('setEqPreset writes when no-op guard read fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read failed'));
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await expect(storage.setEqPreset('flat')).resolves.toBeUndefined();

    expect(setItemSpy).toHaveBeenCalledWith('@musikplayer:eqPreset', 'flat');
  });

  test('rejects invalid eq preset strings when reading', async () => {
    await expect(storage.set(StorageKeys.EQ_PRESET, 'megaBass123' as unknown as string)).resolves.toBe(true);
    await expect(storage.get<string>(StorageKeys.EQ_PRESET)).resolves.toBeNull();
  });

  test('reads raw custom eq preset string via fallback parser', async () => {
    await AsyncStorage.setItem('@musikplayer:eqPreset', 'custom');
    await expect(storage.getEqPreset()).resolves.toBe('custom');
    await expect(storage.get<string>(StorageKeys.EQ_PRESET)).resolves.toBe('custom');
  });

  test('reads JSON custom eq preset string via parser', async () => {
    await AsyncStorage.setItem('@musikplayer:eqPreset', '"custom"');
    await expect(storage.getEqPreset()).resolves.toBe('custom');
    await expect(storage.get<string>(StorageKeys.EQ_PRESET)).resolves.toBe('custom');
  });

  test('falls back to flat for invalid raw eq preset values', async () => {
    await AsyncStorage.setItem('@musikplayer:eqPreset', 'megaBass123');
    await expect(storage.getEqPreset()).resolves.toBe('flat');
  });

  test('falls back to flat for invalid JSON eq preset values', async () => {
    await AsyncStorage.setItem('@musikplayer:eqPreset', '"megaBass123"');
    await expect(storage.getEqPreset()).resolves.toBe('flat');
  });

  test('setEqPreset runtime-guards invalid bypassed values to flat', async () => {
    await expect(storage.setEqPreset('megaBass123' as any)).resolves.toBeUndefined();
    await expect(storage.getEqPreset()).resolves.toBe('flat');
    await expect(storage.get<string>(StorageKeys.EQ_PRESET)).resolves.not.toBe('megaBass123');
  });

  test('setRepeatMode avoids identical raw writes', async () => {
    await storage.setRepeatMode('one');
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await storage.setRepeatMode('one');

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(await storage.getRepeatMode()).toBe('one');
  });

  test('setRepeatMode still overwrites invalid stored raw values', async () => {
    await AsyncStorage.setItem('@musikplayer:repeatMode', 'invalid');
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await storage.setRepeatMode('off');

    expect(setItemSpy).toHaveBeenCalled();
    expect(await storage.getRepeatMode()).toBe('off');
  });
  test('setRepeatMode writes when no-op guard read fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read failed'));
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await expect(storage.setRepeatMode('off')).resolves.toBeUndefined();

    expect(setItemSpy).toHaveBeenCalledWith('@musikplayer:repeatMode', 'off');
  });

  test('getEqEnabled returns persisted boolean values and falls back for invalid raw values', async () => {
    await storage.setEqEnabled(true);
    expect(await storage.getEqEnabled()).toBe(true);

    await storage.setEqEnabled(false);
    expect(await storage.getEqEnabled()).toBe(false);

    await AsyncStorage.setItem('@musikplayer:eqEnabled', 'invalid');
    expect(await storage.getEqEnabled()).toBe(false);
  });

  test('setEqEnabled avoids identical true raw writes', async () => {
    await storage.setEqEnabled(true);
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await storage.setEqEnabled(true);

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(await storage.getEqEnabled()).toBe(true);
  });

  test('setEqEnabled avoids identical false raw writes', async () => {
    await storage.setEqEnabled(false);
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await storage.setEqEnabled(false);

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(await storage.getEqEnabled()).toBe(false);
  });
  test('setEqEnabled writes when no-op guard read fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read failed'));
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await expect(storage.setEqEnabled(true)).resolves.toBeUndefined();

    expect(setItemSpy).toHaveBeenCalledWith('@musikplayer:eqEnabled', 'true');
  });

  test('getShuffle returns persisted boolean values and falls back for invalid raw values', async () => {
    await storage.setShuffle(true);
    expect(await storage.getShuffle()).toBe(true);

    await storage.setShuffle(false);
    expect(await storage.getShuffle()).toBe(false);

    await AsyncStorage.setItem('@musikplayer:shuffle', 'invalid');
    expect(await storage.getShuffle()).toBe(false);
  });

  test('setShuffle avoids identical true raw writes', async () => {
    await storage.setShuffle(true);
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await storage.setShuffle(true);

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(await storage.getShuffle()).toBe(true);
  });

  test('setShuffle avoids identical false raw writes', async () => {
    await storage.setShuffle(false);
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await storage.setShuffle(false);

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(await storage.getShuffle()).toBe(false);
  });
  test('setShuffle writes when no-op guard read fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read failed'));
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await expect(storage.setShuffle(true)).resolves.toBeUndefined();

    expect(setItemSpy).toHaveBeenCalledWith('@musikplayer:shuffle', 'true');
  });

  test('rejects invalid persisted settings', async () => {
    await storage.set(StorageKeys.VOLUME, 'loud');
    await storage.set(StorageKeys.REPEAT_MODE, 'sometimes');
    await storage.set(StorageKeys.SHUFFLE, 'yes');
    await storage.set(StorageKeys.CURRENT_SONG_ID, '   ');

    expect(await storage.get<number>(StorageKeys.VOLUME)).toBeNull();
    expect(await storage.get<string>(StorageKeys.REPEAT_MODE)).toBeNull();
    expect(await storage.get<boolean>(StorageKeys.SHUFFLE)).toBeNull();
    expect(await storage.get<string>(StorageKeys.CURRENT_SONG_ID)).toBeNull();
  });

  test('normalizes volume values for storage', () => {
    expect(normalizeVolumeForStorage(0.5)).toBe(0.5);
    expect(normalizeVolumeForStorage(2)).toBe(1);
    expect(normalizeVolumeForStorage(-1)).toBe(0);
    expect(normalizeVolumeForStorage(Number.NaN)).toBeNull();
    expect(normalizeVolumeForStorage('0.5')).toBeNull();
  });

  test('getVolume defaults to full volume when no value is stored', async () => {
    expect(await storage.getVolume()).toBe(1);
  });

  test('getVolume clamps persisted numeric strings and ignores invalid values', async () => {
    await AsyncStorage.setItem('@musikplayer:volume', '2');
    expect(await storage.getVolume()).toBe(1);

    await AsyncStorage.setItem('@musikplayer:volume', '-1');
    expect(await storage.getVolume()).toBe(0);

    await AsyncStorage.setItem('@musikplayer:volume', '0.5');
    expect(await storage.getVolume()).toBe(0.5);

    await AsyncStorage.setItem('@musikplayer:volume', 'not-a-number');
    expect(await storage.getVolume()).toBe(1);
  });

  test('setVolume persists normalized values', async () => {
    await storage.setVolume(2);
    expect(await storage.getVolume()).toBe(1);

    await storage.setVolume(Number.NaN);
    expect(await storage.getVolume()).toBe(1);
  });

  test('setVolume avoids identical normalized raw writes', async () => {
    await storage.setVolume(0.5);
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await storage.setVolume(0.5);

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(await storage.getVolume()).toBe(0.5);
  });

  test('setVolume overwrites invalid raw values', async () => {
    await AsyncStorage.setItem('@musikplayer:volume', 'invalid');
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await storage.setVolume(1);

    expect(setItemSpy).toHaveBeenCalledWith('@musikplayer:volume', '1');
    expect(await storage.getVolume()).toBe(1);
  });

  test('setVolume writes when no-op guard read fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read failed'));
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await storage.setVolume(0.5);

    expect(setItemSpy).toHaveBeenCalledWith('@musikplayer:volume', '0.5');
  });

  test('normalizes eq band arrays to the safe persisted range', () => {
    expect(normalizeEqBandsForStorage([99, -99, 0, 1, 2, 3, 4, 5, 6, Number.NaN])).toEqual([12, -12, 0, 1, 2, 3, 4, 5, 6, 0]);
    expect(normalizeEqBandsForStorage([1, 2, 3])).toBeNull();
    expect(normalizeEqBandsForStorage([1, 2, 3, 4, 5, 6, 7, 'invalid', 9, 10])).toBeNull();
  });

  test('clamps persisted eq band arrays when reading through generic storage', async () => {
    await storage.set(StorageKeys.EQ_BANDS, [99, -99, 0, 1, 2, 3, 4, 5, 6, Number.NaN]);

    expect(await storage.get<number[]>(StorageKeys.EQ_BANDS)).toEqual([12, -12, 0, 1, 2, 3, 4, 5, 6, 0]);
  });

  test('getEqBands clamps valid-length arrays and falls back for invalid shape', async () => {
    await storage.set(StorageKeys.EQ_BANDS, [99, -99, 0, 1, 2, 3, 4, 5, 6, Number.POSITIVE_INFINITY]);
    expect(await storage.getEqBands()).toEqual([12, -12, 0, 1, 2, 3, 4, 5, 6, 0]);

    await storage.set(StorageKeys.EQ_BANDS, [1, 2, 3]);
    expect(await storage.getEqBands()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  test('getEqBands falls back to flat preset for malformed JSON', async () => {
    await AsyncStorage.setItem('@musikplayer:eqBands', '{invalid-json');
    expect(await storage.getEqBands()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  test('setEqBands persists normalized values', async () => {
    await storage.setEqBands([99, -99, 0, 1, 2, 3, 4, 5, 6, Number.NaN]);

    expect(await storage.getEqBands()).toEqual([12, -12, 0, 1, 2, 3, 4, 5, 6, 0]);
  });

  test('setEqBands avoids identical normalized raw writes', async () => {
    const bands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    await storage.setEqBands(bands);
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await storage.setEqBands(bands);

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(await storage.getEqBands()).toEqual(bands);
  });

  test('setEqBands overwrites invalid raw values', async () => {
    const bands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    await AsyncStorage.setItem('@musikplayer:eqBands', 'invalid');
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await storage.setEqBands(bands);

    expect(setItemSpy).toHaveBeenCalled();
    expect(await storage.getEqBands()).toEqual(bands);
  });

  test('setEqBands writes when no-op guard read fails', async () => {
    const bands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read failed'));
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockClear();

    await storage.setEqBands(bands);

    expect(setItemSpy).toHaveBeenCalled();
  });

  test('setSongs persists normalized songs without legacy favorite fields', async () => {
    await storage.setSongs([
      { id: 's1', title: 'Song', artist: 'Artist', favorite: true, isFavorite: true, customTag: 'keep' },
    ]);

    await expect(storage.get(StorageKeys.SONGS)).resolves.toEqual([
      { id: 's1', title: 'Song', artist: 'Artist', customTag: 'keep' },
    ]);
  });

  test('setSongs filters invalid songs and preserves valid metadata', async () => {
    await storage.setSongs([
      { id: 's1', title: 'Song', artist: 'Artist', fileInfo: { filename: 'a.mp3' }, rating: 5 },
      { id: 'broken', title: 'Missing artist' },
    ] as unknown[]);

    await expect(storage.getSongs()).resolves.toEqual([
      { id: 's1', title: 'Song', artist: 'Artist', fileInfo: { filename: 'a.mp3' }, rating: 5 },
    ]);
  });

  test('setPlaylists persists playlists with required updatedAt', async () => {
    await storage.setPlaylists([{ id: 'pl-1', name: 'Roadtrip', songIds: ['s1'], createdAt: 10, updatedAt: 20 }]);

    await expect(storage.get(StorageKeys.PLAYLISTS)).resolves.toEqual([
      { id: 'pl-1', name: 'Roadtrip', songIds: ['s1'], createdAt: 10, updatedAt: 20 },
    ]);
  });

  test('setPlaylists normalizes legacy playlists without updatedAt and filters invalid entries', async () => {
    await storage.setPlaylists([
      { id: 'pl-1', name: 'Legacy', songIds: ['s1'], createdAt: 10, note: 'keep' },
      { id: 'pl-2', name: 'Broken', songIds: [1], createdAt: 1, updatedAt: 1 },
    ]);

    await expect(storage.getPlaylists()).resolves.toEqual([
      { id: 'pl-1', name: 'Legacy', songIds: ['s1'], createdAt: 10, updatedAt: 10, note: 'keep' },
    ]);
  });

  test('filters invalid songs and playlists', async () => {
    const song = { id: 's1', title: 'Song', artist: 'Artist' };
    const playlist = { id: 'pl-1', name: 'Roadtrip', songIds: ['s1'], createdAt: 1, updatedAt: 1 };

    await storage.set(StorageKeys.SONGS, [song, { title: 'Broken' }]);
    await storage.set(StorageKeys.PLAYLISTS, [playlist, { id: 'pl-2', name: 'Broken', songIds: [1], createdAt: 1, updatedAt: 1 }]);

    expect(await storage.get(StorageKeys.SONGS)).toEqual([song]);
    expect(await storage.get(StorageKeys.PLAYLISTS)).toEqual([playlist]);
  });

  test('normalizes legacy playlists without updatedAt', async () => {
    await storage.set(StorageKeys.PLAYLISTS, [{ id: 'pl-1', name: 'Legacy', songIds: ['s1'], createdAt: 10 }]);
    await expect(storage.get(StorageKeys.PLAYLISTS)).resolves.toEqual([
      { id: 'pl-1', name: 'Legacy', songIds: ['s1'], createdAt: 10, updatedAt: 10 },
    ]);
  });

  test('preserves valid updatedAt from storage playlists', async () => {
    await storage.set(StorageKeys.PLAYLISTS, [{ id: 'pl-1', name: 'Current', songIds: ['s1'], createdAt: 10, updatedAt: 20 }]);
    await expect(storage.get(StorageKeys.PLAYLISTS)).resolves.toEqual([
      { id: 'pl-1', name: 'Current', songIds: ['s1'], createdAt: 10, updatedAt: 20 },
    ]);
  });

  test('does not call Date.now for playlists with valid createdAt and updatedAt', async () => {
    const nowSpy = jest.spyOn(Date, 'now');

    await storage.set(StorageKeys.PLAYLISTS, [{ id: 'pl-1', name: 'Current', songIds: ['s1'], createdAt: 10, updatedAt: 20 }]);
    await expect(storage.get(StorageKeys.PLAYLISTS)).resolves.toEqual([
      { id: 'pl-1', name: 'Current', songIds: ['s1'], createdAt: 10, updatedAt: 20 },
    ]);

    expect(nowSpy).not.toHaveBeenCalled();
  });

  test('does not call Date.now for legacy playlists with valid createdAt but missing updatedAt', async () => {
    const nowSpy = jest.spyOn(Date, 'now');

    await storage.set(StorageKeys.PLAYLISTS, [{ id: 'pl-1', name: 'Legacy', songIds: ['s1'], createdAt: 10 }]);
    await expect(storage.get(StorageKeys.PLAYLISTS)).resolves.toEqual([
      { id: 'pl-1', name: 'Legacy', songIds: ['s1'], createdAt: 10, updatedAt: 10 },
    ]);

    expect(nowSpy).not.toHaveBeenCalled();
  });

  test('calls Date.now once when createdAt and updatedAt are both missing', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1234567890);

    await storage.set(StorageKeys.PLAYLISTS, [{ id: 'pl-1', name: 'Legacy', songIds: ['s1'] }]);
    await expect(storage.get(StorageKeys.PLAYLISTS)).resolves.toEqual([
      { id: 'pl-1', name: 'Legacy', songIds: ['s1'], createdAt: 1234567890, updatedAt: 1234567890 },
    ]);

    expect(nowSpy).toHaveBeenCalledTimes(1);
  });

  test('getPlaylists normalizes legacy playlists without updatedAt', async () => {
    await storage.set(StorageKeys.PLAYLISTS, [{ id: 'pl-1', name: 'Legacy', songIds: ['s1'], createdAt: 10 }]);
    await expect(storage.getPlaylists()).resolves.toEqual([
      { id: 'pl-1', name: 'Legacy', songIds: ['s1'], createdAt: 10, updatedAt: 10 },
    ]);
  });

  test('getPlaylists preserves valid updatedAt and filters invalid entries', async () => {
    await storage.set(StorageKeys.PLAYLISTS, [
      { id: 'pl-1', name: 'Current', songIds: ['s1'], createdAt: 10, updatedAt: 20 },
      { id: 'pl-2', name: 'Broken', songIds: [1], createdAt: 1, updatedAt: 1 },
    ]);
    await expect(storage.getPlaylists()).resolves.toEqual([
      { id: 'pl-1', name: 'Current', songIds: ['s1'], createdAt: 10, updatedAt: 20 },
    ]);
  });

  test('getPlaylists returns [] on broken json payloads', async () => {
    await AsyncStorage.setItem('@musikplayer:playlists', '{"broken":');
    await expect(storage.getPlaylists()).resolves.toEqual([]);
  });

  test('keeps legacy favorite fields parseable but strips them from normalized songs', async () => {
    const storedSong = {
      id: 's1',
      title: 'Song',
      artist: 'Artist',
      favorite: true,
      isFavorite: true,
      fileInfo: { filename: 'track.mp3' },
      customTag: 'x',
    };
    await storage.set(StorageKeys.SONGS, [storedSong]);

    await expect(storage.get(StorageKeys.SONGS)).resolves.toEqual([{
      id: 's1',
      title: 'Song',
      artist: 'Artist',
      fileInfo: { filename: 'track.mp3' },
      customTag: 'x',
    }]);
    await expect(storage.getSongs()).resolves.toEqual([{
      id: 's1',
      title: 'Song',
      artist: 'Artist',
      fileInfo: { filename: 'track.mp3' },
      customTag: 'x',
    }]);
  });

  test('collects and migrates legacy favorite song ids into favoriteSongIds', async () => {
    await storage.set(StorageKeys.FAVORITE_SONG_IDS, ['existing', ' s1 ']);
    await AsyncStorage.setItem('@musikplayer:songs', JSON.stringify([
      { id: 's1', title: 'Song 1', artist: 'A', favorite: true },
      { id: 's2', title: 'Song 2', artist: 'A', isFavorite: true },
      { id: 's3', title: 'Song 3', artist: 'A', favorite: false, isFavorite: false },
      { id: '   ', title: 'Blank', artist: 'A', favorite: true },
      { id: 's2', title: 'Song 2 duplicate', artist: 'A', favorite: true },
      { id: 2, title: 'Broken', artist: 'A', favorite: true },
    ]));

    await expect(migrateLegacySongFavoritesFromStoredSongs()).resolves.toEqual(['existing', 's1', 's2']);
    await expect(getFavoriteSongIds()).resolves.toEqual(['existing', 's1', 's2']);
    await expect(migrateLegacySongFavoritesFromStoredSongs()).resolves.toEqual(['existing', 's1', 's2']);
  });
});
