import SystemAudio from 'expo-system-audio';
import { storage } from '../../utils/storage';
import { hashString128 } from '../../utils/stringHash';
import { blockPersistenceForMaintenance, releasePersistenceMaintenance } from '../../utils/persistenceMaintenance';
import { getAlbumPaletteKey, getPersistentPaletteKey } from '../albumPaletteIdentity';
import { ALBUM_PALETTE_CACHE_KEY, MAX_MEMORY_PALETTES, MAX_PALETTE_CACHE_BYTES, MAX_PERSISTED_PALETTES,
  flushAlbumPaletteCache, getAlbumPaletteCacheStats, hydrateAlbumPaletteCache, readAlbumPaletteCache,
  rememberAlbumPaletteCache, resetAlbumPaletteCacheForTests } from '../albumPaletteCache';
import { extractAlbumPalette, resetAlbumPaletteSingleFlightForTests } from '../albumPaletteHelpers';

jest.mock('../../utils/coverCache', () => ({ getManagedCoverCacheDirectory: () => 'file:///managed/covers' }));
jest.mock('../../utils/storage', () => ({ storage: { get: jest.fn(), set: jest.fn().mockResolvedValue(true) } }));
const uri = (id: number) => `file:///managed/covers/${id.toString(16).padStart(32, '0')}-${hashString128('image/jpeg')}.jpg`;
const key = (id: number) => getPersistentPaletteKey(uri(id))!;
beforeEach(() => { jest.clearAllMocks(); (storage.get as jest.Mock).mockResolvedValue(null); resetAlbumPaletteSingleFlightForTests(); });
afterEach(() => { resetAlbumPaletteSingleFlightForTests(); releasePersistenceMaintenance(); });

test('persists only immutable content-addressed covers; mutable sources are revision-keyed RAM', async () => {
  expect(getPersistentPaletteKey(`file:///managed/covers/${hashString128('file:///cover')}-${hashString128('local:jpg')}.jpg`)).toBeUndefined();
  expect(getPersistentPaletteKey('content://cover/1')).toBeUndefined();
  expect(getAlbumPaletteKey('content://cover/1', 'one')).not.toBe(getAlbumPaletteKey('content://cover/1', 'two'));
  await hydrateAlbumPaletteCache();
  rememberAlbumPaletteCache('content://cover/1|revision:one', { dominant: '#112233' });
  await flushAlbumPaletteCache();
  expect(storage.set).not.toHaveBeenCalled();
  rememberAlbumPaletteCache(key(1), { vibrant: '#44ccaa' }, key(1));
  await flushAlbumPaletteCache();
  const stored = (storage.set as jest.Mock).mock.calls[0][1];
  expect(storage.set).toHaveBeenCalledWith(ALBUM_PALETTE_CACHE_KEY, stored);
  resetAlbumPaletteCacheForTests();
  (storage.get as jest.Mock).mockResolvedValue(stored);
  await hydrateAlbumPaletteCache();
  expect(readAlbumPaletteCache(key(1))).toEqual({ vibrant: '#44ccaa' });
  jest.spyOn(SystemAudio, 'extractPalette').mockResolvedValue({ dominant: '#555555' });
  expect(await extractAlbumPalette(uri(1))).toEqual({ vibrant: '#44ccaa' });
  expect(SystemAudio.extractPalette).not.toHaveBeenCalled();
});
test('keeps 5000 cover entries under explicit RAM and serialized byte budgets', async () => {
  await hydrateAlbumPaletteCache();
  for (let i = 0; i < 5500; i++) rememberAlbumPaletteCache(key(i), { vibrant: '#44ccaa' }, key(i));
  const stats = getAlbumPaletteCacheStats();
  expect(stats.memoryEntries).toBeLessThanOrEqual(MAX_MEMORY_PALETTES);
  expect(stats.persistedEntries).toBe(MAX_PERSISTED_PALETTES);
  expect(stats.persistedBytes).toBeLessThanOrEqual(MAX_PALETTE_CACHE_BYTES);
  expect(readAlbumPaletteCache(key(0))).toBeNull();
  expect(readAlbumPaletteCache(key(5499))).toEqual({ vibrant: '#44ccaa' });
  await flushAlbumPaletteCache();
  expect(JSON.stringify((storage.set as jest.Mock).mock.calls[0][1]).length).toBeLessThanOrEqual(MAX_PALETTE_CACHE_BYTES + 6000);
});
test('a startup read failure never overwrites existing disk state', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  (storage.get as jest.Mock).mockRejectedValue(new Error('read failed'));
  await hydrateAlbumPaletteCache();
  rememberAlbumPaletteCache(key(1), { dominant: '#112233' }, key(1));
  await flushAlbumPaletteCache();
  expect(getAlbumPaletteCacheStats().hydration).toBe('failed');
  expect(readAlbumPaletteCache(key(1))).toEqual({ dominant: '#112233' });
  expect(storage.set).not.toHaveBeenCalled();
  warn.mockRestore();
});
test('corrupt entries are ignored without poisoning valid cover colors', async () => {
  (storage.get as jest.Mock).mockResolvedValue({ version: 1, entries: [
    { key: key(1), palette: { dominant: '#112233', vibrant: 'invalid', extra: '#ffffff' } },
    { key: key(2), palette: { dominant: 'javascript:bad' } },
    { key: 'content://untrusted', palette: { dominant: '#223344' } },
  ] });
  await hydrateAlbumPaletteCache();
  expect(readAlbumPaletteCache(key(1))).toEqual({ dominant: '#112233' });
  expect(readAlbumPaletteCache(key(2))).toBeNull();
  expect(readAlbumPaletteCache('content://untrusted')).toBeNull();
});
test('a late startup read cannot replace a newer extracted palette or cross a restore epoch', async () => {
  let finish!: (value: unknown) => void;
  (storage.get as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const load = hydrateAlbumPaletteCache();
  rememberAlbumPaletteCache(key(1), { dominant: '#223344' }, key(1));
  finish({ version: 1, entries: [{ key: key(1), palette: { dominant: '#111111' } }] });
  await load;
  expect(readAlbumPaletteCache(key(1))).toEqual({ dominant: '#223344' });
  resetAlbumPaletteCacheForTests();
  (storage.get as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const lateLoad = hydrateAlbumPaletteCache();
  blockPersistenceForMaintenance(); releasePersistenceMaintenance();
  expect(readAlbumPaletteCache(key(1))).toBeNull();
  finish({ version: 1, entries: [{ key: key(1), palette: { dominant: '#111111' } }] });
  await lateLoad;
  expect(readAlbumPaletteCache(key(1))).toBeNull();
});
test('late native results from a restored owner never repopulate the new cache', async () => {
  let finish!: (value: { dominant: string }) => void;
  jest.spyOn(SystemAudio, 'extractPalette').mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const result = extractAlbumPalette('content://cover/1', { revision: 'old' });
  blockPersistenceForMaintenance(); releasePersistenceMaintenance();
  finish({ dominant: '#112233' });
  expect(await result).toBeNull();
  expect(getAlbumPaletteCacheStats().memoryEntries).toBe(0);
});
