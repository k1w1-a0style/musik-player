import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  normalizeCurrentSongIdForPersistence,
  persistCurrentSongIdForLibrary,
} from '../useMusicPlaybackRefs';
import { StorageKeys, storage } from '../../utils/storage';
import type { Song } from '../../types/Song';

const track = (id: string): Song => ({
  id,
  title: id,
  artist: 'Artist',
  uri: `file:///${id}.mp3`,
});

describe('musicPlaybackRefs helpers', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  test('normalizes current song ids for persistence', () => {
    expect(normalizeCurrentSongIdForPersistence(' s1 ')).toBe('s1');
    expect(normalizeCurrentSongIdForPersistence('')).toBeUndefined();
    expect(normalizeCurrentSongIdForPersistence('   ')).toBeUndefined();
    expect(normalizeCurrentSongIdForPersistence(123)).toBeUndefined();
    expect(normalizeCurrentSongIdForPersistence(null)).toBeUndefined();
  });

  test('persists trimmed current song id only when it belongs to the library', async () => {
    await persistCurrentSongIdForLibrary(track(' s1 '), [track('s1')]);

    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBe('s1');
  });

  test('removes current song id when the selected song is not in the library', async () => {
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');

    await persistCurrentSongIdForLibrary(track('s2'), [track('s1')]);

    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
  });

  test('removes current song id for null or blank song ids', async () => {
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');
    await persistCurrentSongIdForLibrary(null, [track('s1')]);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();

    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');
    await persistCurrentSongIdForLibrary(track('   '), [track('s1')]);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
  });
});
