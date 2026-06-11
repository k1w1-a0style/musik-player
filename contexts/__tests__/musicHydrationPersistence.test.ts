import AsyncStorage from '@react-native-async-storage/async-storage';
import { createHydrationPlan } from '../musicHydrationPlan';
import {
  persistHydratedCurrentSongIdIfNeeded,
  persistHydratedPlaylistsIfNeeded,
  persistHydratedSongsIfNeeded,
} from '../musicHydrationPersistence';
import { StorageKeys, storage } from '../../utils/storage';
import type { Playlist, Song } from '../../types/Song';

const song: Song = { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' };
const storedDefaults = {
  eqEnabled: null,
  eqBands: null,
  eqPreset: null,
  volume: null,
  repeatMode: null,
  shuffle: false,
};

describe('musicHydrationPersistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  test('persists normalized songs, playlists, and current song id from a plan', async () => {
    const playlist: Playlist = { id: 'pl-1', name: 'List', songIds: [' s1 ', 'missing'], createdAt: 1, updatedAt: 1 };
    const plan = createHydrationPlan({ ...storedDefaults, songs: [{ ...song, id: ' s1 ' }], playlists: [playlist], currentSongId: ' s1 ' }, [
      { ...song, id: ' s1 ' },
    ]);

    await expect(persistHydratedSongsIfNeeded(plan)).resolves.toEqual({ status: 'confirmed' });
    await persistHydratedPlaylistsIfNeeded(plan);
    await persistHydratedCurrentSongIdIfNeeded(plan);

    await expect(storage.get(StorageKeys.SONGS)).resolves.toEqual([expect.objectContaining({ id: 's1' })]);
    await expect(storage.get(StorageKeys.PLAYLISTS)).resolves.toEqual([expect.objectContaining({ songIds: ['s1'] })]);
    await expect(storage.get(StorageKeys.CURRENT_SONG_ID)).resolves.toBe('s1');
  });

  test('returns not-needed when hydrated songs already match storage', async () => {
    const plan = createHydrationPlan({ ...storedDefaults, songs: [song], playlists: null, currentSongId: null }, [song]);

    await expect(persistHydratedSongsIfNeeded(plan)).resolves.toEqual({ status: 'not-needed' });
  });

  test('returns unconfirmed without throwing when hydrated songs write returns false', async () => {
    const plan = createHydrationPlan({ ...storedDefaults, songs: [{ ...song, id: ' s1 ' }], playlists: null, currentSongId: null }, [
      { ...song, id: ' s1 ' },
    ]);
    jest.spyOn(storage, 'set').mockResolvedValueOnce(false);

    await expect(persistHydratedSongsIfNeeded(plan)).resolves.toEqual({ status: 'unconfirmed' });
  });

  test('returns unconfirmed with the error when hydrated songs write rejects', async () => {
    const error = new Error('write rejected');
    const plan = createHydrationPlan({ ...storedDefaults, songs: [{ ...song, id: ' s1 ' }], playlists: null, currentSongId: null }, [
      { ...song, id: ' s1 ' },
    ]);
    jest.spyOn(storage, 'set').mockRejectedValueOnce(error);

    await expect(persistHydratedSongsIfNeeded(plan)).resolves.toEqual({ status: 'unconfirmed', error });
  });

  test('removes current song id when the plan marks it stale', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');
    const plan = createHydrationPlan({ ...storedDefaults, songs: [song], playlists: null, currentSongId: 's1' }, [
      { ...song, uri: '   ' },
    ]);

    await persistHydratedCurrentSongIdIfNeeded(plan);

    await expect(storage.get(StorageKeys.CURRENT_SONG_ID)).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      '[MusicHydration] Restored current song is not playable; clearing persisted current song id.',
      expect.objectContaining({ songId: 's1' }),
    );
    warn.mockRestore();
  });
});
