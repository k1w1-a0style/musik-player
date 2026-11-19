import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadStoredMusicHydrationState } from '../../contexts/musicHydrationLoad';
import { createHydrationPlan } from '../../contexts/musicHydrationPlan';
import type { Song } from '../../types/Song';
import { parseMusicBackup } from '../backupFormat';
import { toBackupSongReference } from '../backupMapping';
import { selectActiveLibrarySongs, reconcileSourceObservation } from '../librarySourceOwnership';
import { LIBRARY_UPDATE_KEY, normalizeLibraryUpdate } from '../libraryUpdatePreferences';
import { getResumeSource, RESUME_ENABLED_KEY, RESUME_POSITIONS_KEY, serializeResumePositions } from '../resumePosition';
import { ResumePositionStore } from '../resumePositionStore';
import { SONG_LIBRARY_MANIFEST_KEY, resetSongLibraryStorageForTests } from '../songLibraryStorage';
import { migrateLegacySongFavoritesFromStoredSongs, storage } from '../storage';

const tree = 'content://com.android.externalstorage.documents/tree/primary%3AMusic';
const safUri = tree + '/document/primary%3AMusic%2FMix.mp3';
const mediaUri = 'content://media/external/audio/media/82';
const directory = { id: 'folder', name: 'Music', enabled: true, uri: tree, addedAt: 1 };
const songs: Song[] = [
  { id: 'saf-stable', uri: safUri, title: 'Handbearbeiteter Mix', artist: 'SpeedFanaTEK', album: 'Test',
    duration: 3_900_000, genre: 'Techno', comment: 'Lokale ID3-Bearbeitung',
    fileInfo: { source: 'saf', uri: safUri, librarySources: [tree], size: 62_000_000, modificationTime: 1700000000000 } },
  { id: 'download-stable', title: 'Handbearbeiteter Mix', artist: 'SpeedFanaTEK', uri: mediaUri,
    fileInfo: { source: 'media-library', uri: mediaUri, filename: 'Mix.mp3', librarySources: ['media-library'] } },
];
const playlist = { id: 'old-list', name: 'Altbestand', songIds: songs.map(song => song.id), createdAt: 1, updatedAt: 2 };
const oldUpdate = { onOpen: true, whileOpen: false };
const key = (name: string) => '@musikplayer:' + name;
const pausedAt = 876_000;

beforeEach(async () => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
  resetSongLibraryStorageForTests();
  await AsyncStorage.multiSet(Object.entries({
    songs: [{ ...songs[0], favorite: true }, songs[1]],
    playlists: [playlist], favoriteSongIds: [songs[1].id], scanFolders: [directory],
    currentSongId: songs[0].id, repeatMode: 'all', volume: .67, [LIBRARY_UPDATE_KEY]: oldUpdate, [RESUME_ENABLED_KEY]: true,
  }).map(([name, value]) => [key(name), JSON.stringify(value)]));
  await AsyncStorage.setItem(key(RESUME_POSITIONS_KEY), serializeResumePositions([{
    songId: songs[0].id, source: getResumeSource(songs[0])!, positionMs: pausedAt, durationMs: 3_900_000, updatedAt: Date.now(),
  }]));
});

test('hydrate pre-scope state without dropping IDs, metadata, favorites, resume selection or backup references', async () => {
  const stored = await loadStoredMusicHydrationState();
  const plan = createHydrationPlan(stored, stored.songs!);
  const storedFavorites = await storage.getFavoriteSongIds();
  const scope = normalizeLibraryUpdate(await storage.get(LIBRARY_UPDATE_KEY));
  const folders = await storage.getScanFolders();

  expect(plan.hydratedSongs).toEqual(songs);
  expect(plan.normalizedPlaylists).toEqual([playlist]);
  expect(plan.resolvedCurrentSongId).toBe(songs[0].id);
  expect(plan.currentSongPersistence).toEqual({ action: 'keep' });
  expect(storedFavorites).toEqual([songs[1].id, songs[0].id]);
  expect(stored).toMatchObject({ volume: .67, repeatMode: 'all' });
  expect(scope).toEqual({ ...oldUpdate, includeDeviceMusic: false });
  expect(selectActiveLibrarySongs(plan.hydratedSongs, folders, scope.includeDeviceMusic)).toEqual([songs[0]]);
  expect(selectActiveLibrarySongs(plan.hydratedSongs, folders, true)).toEqual(songs);
  expect(selectActiveLibrarySongs(plan.hydratedSongs, [{ ...directory, removed: true }])).toEqual([]);
  expect(selectActiveLibrarySongs(reconcileSourceObservation(plan.hydratedSongs, {
    source: tree, uris: [], complete: false,
  }), folders)).toEqual([songs[0]]);
  expect(selectActiveLibrarySongs(reconcileSourceObservation(plan.hydratedSongs, {
    source: tree, uris: [safUri], complete: true,
  }), [directory])).toMatchObject([songs[0]]);
  const resume = new ResumePositionStore();
  resume.setEnabled(await storage.get(RESUME_ENABLED_KEY) === true);
  await expect(resume.lookup(plan.hydratedSongs[0])).resolves.toMatchObject({ positionMs: pausedAt });

  const oldBackup = { format: 'k1w1-musik-backup', version: 1, createdAt: 1700000000000,
    songs: songs.map(toBackupSongReference), favorites: storedFavorites, playlists: [playlist],
    settings: { libraryUpdateV1: oldUpdate } };
  expect(parseMusicBackup(JSON.stringify(oldBackup))).toEqual(oldBackup);
});

test('malformed old scan preference uses safe scope while leaving persisted library and settings recoverable', async () => {
  await AsyncStorage.setItem(key(LIBRARY_UPDATE_KEY), '{');
  const stored = await loadStoredMusicHydrationState();
  expect(stored.songs).toEqual(songs);
  expect(stored.playlists).toEqual([playlist]);
  await expect(AsyncStorage.getItem(SONG_LIBRARY_MANIFEST_KEY)).resolves.not.toBeNull();
  await expect(AsyncStorage.getItem(key(LIBRARY_UPDATE_KEY))).resolves.toBe('{');
  expect(normalizeLibraryUpdate(await storage.get(LIBRARY_UPDATE_KEY)).includeDeviceMusic).toBe(false);
});

test('a temporary favorites read failure cannot overwrite previously saved favorites', async () => {
  const original = (AsyncStorage.getItem as jest.Mock).getMockImplementation()!;
  jest.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(async name => {
    expect(name).toBe(key('favoriteSongIds'));
    throw new Error('temporary SQLite read failure');
  });
  await migrateLegacySongFavoritesFromStoredSongs();
  await expect(original(key('favoriteSongIds'))).resolves.toBe(JSON.stringify([songs[1].id]));
  await expect(original(key('legacySongFavoritesMigrationCompleted'))).resolves.toBeNull();
  await expect(migrateLegacySongFavoritesFromStoredSongs()).resolves.toEqual([songs[1].id, songs[0].id]);
});

test('does not replace corrupt favorites or finalize an unverified migration', async () => {
  const damaged = '{"interrupted":';
  await AsyncStorage.setItem(key('favoriteSongIds'), damaged);
  await migrateLegacySongFavoritesFromStoredSongs();
  await expect(AsyncStorage.getItem(key('favoriteSongIds'))).resolves.toBe(damaged);
  await expect(AsyncStorage.getItem(key('legacySongFavoritesMigrationCompleted'))).resolves.toBeNull();
});

test('preserves the current favorites if the previous migration marker cannot be read', async () => {
  await AsyncStorage.setItem(key('legacySongFavoritesMigrationCompleted'), '{');
  await expect(migrateLegacySongFavoritesFromStoredSongs()).resolves.toEqual([songs[1].id]);
  await expect(storage.getFavoriteSongIds()).resolves.toEqual([songs[1].id]);
  await expect(AsyncStorage.getItem(key('legacySongFavoritesMigrationCompleted'))).resolves.toBe('{');
});
