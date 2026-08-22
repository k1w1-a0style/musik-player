import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitFor } from '@testing-library/react-native';
import TrackPlayer, { State } from 'react-native-track-player';
import {
  applyStoredPlaybackSettings,
  hydrateStoredSongs,
  loadStoredMusicHydrationState,
  runMusicHydration,
  sanitizeStoredPlaylistsForHydration,
  type StoredMusicHydrationState,
} from '../musicHydrationHelpers';
import { StorageKeys, storage } from '../../utils/storage';
import { cleanupCoverCache, createCoverCacheProtection } from '../../utils/coverCacheCleanup';
import type { Playlist, Song } from '../../types/Song';
import {
  acquireSongCoverProtection,
  resetSongCoverProtectionLifecycleForTests,
} from '../songCoverProtectionLifecycle';
import {
  resetNativeQueueMutationLockForTests,
  runExclusiveNativeQueueReplacement,
} from '../../utils/nativeQueueMutationLock';
import { seekToMillis } from '../playbackControlHelpers';

const mockMigrateLegacySongFavoritesFromStoredSongs = jest.fn();

jest.mock('../../utils/coverCacheCleanup', () => ({
  cleanupCoverCache: jest.fn(async () => undefined),
  createCoverCacheProtection: jest.fn(() => ({
    protectUri: jest.fn(),
    protectSongCovers: jest.fn(),
    replaceProtectedSongCovers: jest.fn(),
    release: jest.fn(),
  })),
  invalidateCoverCacheCleanup: jest.fn(),
  waitForCoverCacheCleanupIdle: jest.fn(async () => undefined),
}));

jest.mock('../../utils/storage', () => {
  const actual = jest.requireActual('../../utils/storage');
  return {
    ...actual,
    migrateLegacySongFavoritesFromStoredSongs: () => mockMigrateLegacySongFavoritesFromStoredSongs(),
  };
});

const songs: Song[] = [{ id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }];
const playlists: Playlist[] = [{ id: 'pl-1', name: 'List', songIds: ['s1'], createdAt: 1, updatedAt: 1 }];
const eqBands = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const createSongRef = () => ({ current: [] as Song[] });
const nativeMutationImplementations = {
  reset: (TrackPlayer.reset as jest.Mock).getMockImplementation(),
  add: (TrackPlayer.add as jest.Mock).getMockImplementation(),
  play: (TrackPlayer.play as jest.Mock).getMockImplementation(),
  pause: (TrackPlayer.pause as jest.Mock).getMockImplementation(),
  stop: (TrackPlayer.stop as jest.Mock).getMockImplementation(),
  skip: (TrackPlayer.skip as jest.Mock).getMockImplementation(),
  seekTo: (TrackPlayer.seekTo as jest.Mock).getMockImplementation(),
};

describe('musicHydrationHelpers', () => {
  beforeEach(async () => {
    const player = TrackPlayer as unknown as { __reset: () => void; __getQueue: () => Song[]; __getActiveTrackIndex: () => number; __getState: () => State };
    player.__reset();
    resetSongCoverProtectionLifecycleForTests();
    resetNativeQueueMutationLockForTests();
    await AsyncStorage.clear();
    jest.clearAllMocks();
    for (const [method, implementation] of Object.entries(nativeMutationImplementations)) {
      (TrackPlayer[method as keyof typeof nativeMutationImplementations] as jest.Mock).mockImplementation(implementation);
    }
    (TrackPlayer.getQueue as jest.Mock).mockImplementation(async () => player.__getQueue());
    (TrackPlayer.getActiveTrack as jest.Mock).mockImplementation(async () => player.__getQueue()[player.__getActiveTrackIndex()]);
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockImplementation(async () => player.__getActiveTrackIndex() >= 0 ? player.__getActiveTrackIndex() : undefined);
    (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 0 });
    (TrackPlayer.getPlaybackState as jest.Mock).mockImplementation(async () => ({ state: player.__getState() }));
    mockMigrateLegacySongFavoritesFromStoredSongs.mockResolvedValue([]);
  });

  test('loads stored music hydration state', async () => {
    await storage.set(StorageKeys.SONGS, songs);
    await storage.set(StorageKeys.PLAYLISTS, playlists);
    await storage.set(StorageKeys.EQ_ENABLED, true);
    await storage.set(StorageKeys.EQ_BANDS, eqBands);
    await storage.set(StorageKeys.EQ_PRESET, 'rock');
    await storage.set(StorageKeys.VOLUME, 0.7);
    await storage.set(StorageKeys.REPEAT_MODE, 'all');
    await storage.set(StorageKeys.SHUFFLE, true);
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');

    await expect(loadStoredMusicHydrationState()).resolves.toEqual({
      songs,
      playlists,
      eqEnabled: true,
      eqBands,
      eqPreset: 'rock',
      volume: 0.7,
      repeatMode: 'all',
      shuffle: true,
      currentSongId: 's1',
    });
    expect(mockMigrateLegacySongFavoritesFromStoredSongs).toHaveBeenCalledTimes(1);
  });

  test('starts stored-state reads without waiting for legacy favorites migration', async () => {
    let finishMigration!: () => void;
    const pendingMigration = new Promise<string[]>(resolve => {
      finishMigration = () => resolve([]);
    });
    mockMigrateLegacySongFavoritesFromStoredSongs.mockReturnValueOnce(pendingMigration);
    const getSpy = jest.spyOn(storage, 'get');

    const loading = loadStoredMusicHydrationState();
    await Promise.resolve();

    expect(getSpy).toHaveBeenCalledTimes(9);
    finishMigration();
    await loading;
    getSpy.mockRestore();
  });

  test('validates and normalizes stored playback settings during hydration load', async () => {
    await storage.set(StorageKeys.SONGS, songs);
    await AsyncStorage.setItem('@musikplayer:volume', '2');
    await AsyncStorage.setItem('@musikplayer:repeatMode', JSON.stringify('invalid-repeat'));
    await AsyncStorage.setItem('@musikplayer:eqBands', JSON.stringify([99, -99, 0, 1, 2, 3, 4, 5, 6, 10]));
    await AsyncStorage.setItem('@musikplayer:eqPreset', JSON.stringify('missing-preset'));
    await AsyncStorage.setItem('@musikplayer:eqEnabled', JSON.stringify('true'));
    await AsyncStorage.setItem('@musikplayer:shuffle', JSON.stringify({ enabled: true }));
    await AsyncStorage.setItem('@musikplayer:currentSongId', JSON.stringify(' s1 '));

    await expect(loadStoredMusicHydrationState()).resolves.toEqual({
      songs,
      playlists: null,
      eqEnabled: true,
      eqBands: [12, -12, 0, 1, 2, 3, 4, 5, 6, 10],
      eqPreset: null,
      volume: 1,
      repeatMode: null,
      shuffle: null,
      currentSongId: 's1',
    });
  });

  test('returns null hydration settings for corrupt or invalid persisted scalar values', async () => {
    await AsyncStorage.setItem('@musikplayer:volume', JSON.stringify({ value: 0.5 }));
    await AsyncStorage.setItem('@musikplayer:repeatMode', '{broken-json');
    await AsyncStorage.setItem('@musikplayer:eqBands', JSON.stringify([0, 0, 0]));
    await AsyncStorage.setItem('@musikplayer:eqPreset', JSON.stringify(false));
    await AsyncStorage.setItem('@musikplayer:eqEnabled', JSON.stringify('not-bool'));
    await AsyncStorage.setItem('@musikplayer:shuffle', JSON.stringify('not-bool'));
    await AsyncStorage.setItem('@musikplayer:currentSongId', JSON.stringify('   '));

    await expect(loadStoredMusicHydrationState()).resolves.toEqual({
      songs: null,
      playlists: null,
      eqEnabled: null,
      eqBands: null,
      eqPreset: null,
      volume: null,
      repeatMode: null,
      shuffle: null,
      currentSongId: null,
    });
  });

  test('sanitizes hydrated playlists against the stored library', () => {
    const stored: StoredMusicHydrationState = {
      songs,
      playlists: [{ id: 'pl-1', name: 'Dirty', songIds: ['s1', 'missing', 's1'], createdAt: 1, updatedAt: 1 }],
      eqEnabled: null,
      eqBands: null,
      eqPreset: null,
      volume: null,
      repeatMode: null,
      shuffle: null,
      currentSongId: null,
    };

    expect(sanitizeStoredPlaylistsForHydration(stored)).toEqual([
      expect.objectContaining({ id: 'pl-1', name: 'Dirty', songIds: ['s1'], createdAt: 1, updatedAt: expect.any(Number) }),
    ]);
  });

  test('hydrates stored songs and native queue', async () => {
    const songsRef = createSongRef();
    const queueContextRef = createSongRef();
    const baseQueueContextRef = createSongRef();
    const nativeQueueRef = createSongRef();
    const setSongsState = jest.fn();
    const setCurrentSong = jest.fn();
    const setPlaybackQueue = jest.fn();

    await hydrateStoredSongs({
      stored: {
        songs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: 's1',
      },
      songsRef,
      queueContextRef,
      baseQueueContextRef,
      nativeQueueRef,
      setSongsState,
      setCurrentSong,
      setPlaybackQueue,
      isCancelled: () => false,
    });

    expect(songsRef.current).toEqual(songs);
    expect(queueContextRef.current).toEqual(songs);
    expect(baseQueueContextRef.current).toEqual(songs);
    expect(nativeQueueRef.current).toEqual(songs);
    expect(setSongsState).toHaveBeenCalledWith(songs);
    expect(setCurrentSong).toHaveBeenCalledWith(songs[0]);
    expect(setPlaybackQueue).toHaveBeenCalledWith(songs);
    expect(TrackPlayer.reset).toHaveBeenCalled();
    expect(TrackPlayer.add).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 's1' })]));
  });

  test('does not set non-playable restored song as current, clears persisted current song id, and clears native queue', async () => {
    const malformedSongs: Song[] = [
      { id: 's1', title: 'One', artist: 'A', uri: '   ' },
      { id: 's2', title: 'Two', artist: 'A', uri: 'file:///s2.mp3' },
    ];
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');
    const setCurrentSong = jest.fn();
    const nativeQueueRef = createSongRef();

    await hydrateStoredSongs({
      stored: {
        songs: malformedSongs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: 's1',
      },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef,
      setSongsState: jest.fn(),
      setCurrentSong,
      setPlaybackQueue: jest.fn(),
      isCancelled: () => false,
    });

    expect(setCurrentSong).toHaveBeenCalledWith(null);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
    expect(nativeQueueRef.current).toEqual([]);
    expect(TrackPlayer.reset).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.add).not.toHaveBeenCalled();
  });

  test('does not reset native queue when no persisted current song exists', async () => {
    const songsRef = createSongRef();
    const queueContextRef = createSongRef();
    const baseQueueContextRef = createSongRef();
    const nativeQueueRef = createSongRef();
    nativeQueueRef.current = [{ id: 'native', title: 'Native', artist: 'A', uri: 'file:///native.mp3' }];
    const setPlaybackQueue = jest.fn();

    await hydrateStoredSongs({
      stored: {
        songs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: null,
      },
      songsRef,
      queueContextRef,
      baseQueueContextRef,
      nativeQueueRef,
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue,
      isCancelled: () => false,
    });

    expect(songsRef.current).toEqual(songs);
    expect(queueContextRef.current).toEqual([]);
    expect(baseQueueContextRef.current).toEqual([]);
    expect(setPlaybackQueue).toHaveBeenCalledWith([]);
    expect(nativeQueueRef.current).toEqual([]);
    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(TrackPlayer.add).not.toHaveBeenCalled();
  });

  test('clears stale native queue when no persisted current song exists and hydration has no playable songs', async () => {
    const malformedSongs: Song[] = [
      { id: 's1', title: 'One', artist: 'A', uri: '   ' },
      { id: 's2', title: 'Two', artist: 'A' },
    ];
    const queueContextRef = createSongRef();
    const nativeQueueRef = createSongRef();
    nativeQueueRef.current = [{ id: 'stale', title: 'Stale', artist: 'A', uri: 'file:///stale.mp3' }];
    const setPlaybackQueue = jest.fn();

    const result = await hydrateStoredSongs({
      stored: {
        songs: malformedSongs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: null,
      },
      songsRef: createSongRef(),
      queueContextRef,
      baseQueueContextRef: createSongRef(),
      nativeQueueRef,
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue,
      isCancelled: () => false,
    });

    expect(queueContextRef.current).toEqual([]);
    expect(setPlaybackQueue).toHaveBeenCalledWith([]);
    expect(nativeQueueRef.current).toEqual([]);
    expect(result.currentSongId).toBeNull();
    expect(TrackPlayer.reset).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.add).not.toHaveBeenCalled();
  });

  test('keeps refs uncommitted when reset fails while clearing a malformed restored song', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const malformedSongs: Song[] = [
      { id: 's1', title: 'One', artist: 'A', uri: '   ' },
      { id: 's2', title: 'Two', artist: 'A', uri: 'file:///s2.mp3' },
    ];
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');
    (TrackPlayer.reset as jest.Mock).mockRejectedValueOnce(new Error('reset failed'));
    const queueContextRef = createSongRef();
    const baseQueueContextRef = createSongRef();
    const nativeQueueRef = createSongRef();
    const setPlaybackQueue = jest.fn();
    nativeQueueRef.current = [{ id: 'stale', title: 'Stale', artist: 'A', uri: 'file:///stale.mp3' }];
    queueContextRef.current = nativeQueueRef.current.slice();
    baseQueueContextRef.current = nativeQueueRef.current.slice();

    await hydrateStoredSongs({
      stored: {
        songs: malformedSongs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: 's1',
      },
      songsRef: createSongRef(),
      queueContextRef,
      baseQueueContextRef,
      nativeQueueRef,
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue,
      isCancelled: () => false,
    });

    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
    expect(nativeQueueRef.current).toEqual([]);
    expect(queueContextRef.current).toEqual([]);
    expect(baseQueueContextRef.current).toEqual([]);
    expect(setPlaybackQueue).toHaveBeenCalledWith([]);
    expect(setPlaybackQueue).toHaveBeenCalledWith([]);
  });

  test('hydrates mixed queue with only playable songs and keeps currentSong aligned with playable queue', async () => {
    const mixedSongs: Song[] = [
      { id: 's1', title: 'Bad', artist: 'A', uri: '   ' },
      { id: 's2', title: 'Two', artist: 'A', uri: 'file:///s2.mp3' },
      { id: 's3', title: 'Three', artist: 'A', uri: 'file:///s3.mp3' },
    ];
    const queueContextRef = createSongRef();
    const nativeQueueRef = createSongRef();
    const setPlaybackQueue = jest.fn();
    const setCurrentSong = jest.fn();

    await hydrateStoredSongs({
      stored: {
        songs: mixedSongs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: 's2',
      },
      songsRef: createSongRef(),
      queueContextRef,
      baseQueueContextRef: createSongRef(),
      nativeQueueRef,
      setSongsState: jest.fn(),
      setCurrentSong,
      setPlaybackQueue,
      isCancelled: () => false,
    });

    expect(queueContextRef.current.map(song => song.id)).toEqual(['s2', 's3']);
    expect(nativeQueueRef.current.map(song => song.id)).toEqual(['s2', 's3']);
    expect(setPlaybackQueue).toHaveBeenCalledWith([
      expect.objectContaining({ id: 's2' }),
      expect.objectContaining({ id: 's3' }),
    ]);
    expect(setCurrentSong).toHaveBeenCalledWith(expect.objectContaining({ id: 's2' }));
  });

  test('restores playable song with whitespace id and normalizes hydrated playback ids', async () => {
    const songsWithWhitespaceId: Song[] = [
      { id: ' s1 ', title: 'One', artist: 'A', uri: ' file:///s1.mp3 ' },
      { id: 's2', title: 'Two', artist: 'A', uri: 'file:///s2.mp3' },
    ];
    await storage.set(StorageKeys.CURRENT_SONG_ID, ' s1 ');
    const queueContextRef = createSongRef();
    const nativeQueueRef = createSongRef();
    const setCurrentSong = jest.fn();

    await hydrateStoredSongs({
      stored: {
        songs: songsWithWhitespaceId,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: 's1',
      },
      songsRef: createSongRef(),
      queueContextRef,
      baseQueueContextRef: createSongRef(),
      nativeQueueRef,
      setSongsState: jest.fn(),
      setCurrentSong,
      setPlaybackQueue: jest.fn(),
      isCancelled: () => false,
    });

    expect(setCurrentSong).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
    expect(queueContextRef.current.map(song => song.id)).toEqual(['s1', 's2']);
    expect(nativeQueueRef.current.map(song => song.id)).toEqual(['s1', 's2']);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBe('s1');
  });

  test('skips stored song hydration when cancelled', async () => {
    const songsRef = createSongRef();
    const queueContextRef = createSongRef();
    const baseQueueContextRef = createSongRef();
    const nativeQueueRef = createSongRef();
    const setSongsState = jest.fn();

    await hydrateStoredSongs({
      stored: {
        songs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: 's1',
      },
      songsRef,
      queueContextRef,
      baseQueueContextRef,
      nativeQueueRef,
      setSongsState,
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => true,
    });

    expect(songsRef.current).toEqual([]);
    expect(setSongsState).not.toHaveBeenCalled();
    expect(TrackPlayer.reset).not.toHaveBeenCalled();
  });

  test('stops native queue hydration when cancelled after TrackPlayer reset', async () => {
    const nativeQueueRef = createSongRef();
    let cancelled = false;
    (TrackPlayer.reset as jest.Mock).mockImplementationOnce(async () => {
      cancelled = true;
    });

    await hydrateStoredSongs({
      stored: {
        songs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: 's1',
      },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef,
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => cancelled,
    });

    expect(TrackPlayer.add).not.toHaveBeenCalled();
    expect(nativeQueueRef.current).toEqual([]);
  });

  test('drops a seek requested while the hydrated native queue is being replaced', async () => {
    const nativeQueueRef = createSongRef();
    (TrackPlayer.reset as jest.Mock).mockImplementationOnce(async () => {
      void seekToMillis(5000);
    });

    await hydrateStoredSongs({
      stored: {
        songs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: 's1',
      },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef,
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => false,
    });

    expect(TrackPlayer.add).toHaveBeenCalledWith([expect.objectContaining({ id: 's1' })]);
    expect(nativeQueueRef.current.map(song => song.id)).toEqual(['s1']);
    await Promise.resolve();
    expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
  });

  test('sets hydrated native queue ref when add is superseded after starting', async () => {
    const nativeQueueRef = createSongRef();
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(async () => {
      void runExclusiveNativeQueueReplacement(async () => undefined);
    });

    await hydrateStoredSongs({
      stored: {
        songs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: 's1',
      },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef,
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => false,
    });

    expect(TrackPlayer.add).toHaveBeenCalledWith([expect.objectContaining({ id: 's1' })]);
    expect(nativeQueueRef.current).toEqual([]);
  });

  test('sets hydrated native queue ref when cancelled after add', async () => {
    const nativeQueueRef = createSongRef();
    let cancelled = false;
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(async () => {
      cancelled = true;
    });

    await hydrateStoredSongs({
      stored: {
        songs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: 's1',
      },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef,
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => cancelled,
    });

    expect(TrackPlayer.add).toHaveBeenCalled();
    expect(nativeQueueRef.current).toEqual([]);
  });

  test('clears native ref and keeps queue refs uncommitted when hydrated native queue initialization fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const queueContextRef = createSongRef();
    const baseQueueContextRef = createSongRef();
    const nativeQueueRef = createSongRef();
    const setPlaybackQueue = jest.fn();
    const setCurrentSong = jest.fn();
    nativeQueueRef.current = songs.slice();
    queueContextRef.current = [{ id: 'old', title: 'Old', artist: 'A', uri: 'file:///old.mp3' }];
    baseQueueContextRef.current = queueContextRef.current.slice();
    (TrackPlayer.add as jest.Mock).mockRejectedValueOnce(new Error('native add failed'));

    await hydrateStoredSongs({
      stored: {
        songs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: 's1',
      },
      songsRef: createSongRef(),
      queueContextRef,
      baseQueueContextRef,
      nativeQueueRef,
      setSongsState: jest.fn(),
      setCurrentSong,
      setPlaybackQueue,
      isCancelled: () => false,
    });

    expect(nativeQueueRef.current).toEqual([]);
    expect(queueContextRef.current).toEqual([]);
    expect(baseQueueContextRef.current).toEqual([]);
    expect(setPlaybackQueue).toHaveBeenCalledWith([]);
    expect(setCurrentSong).toHaveBeenCalledWith(null);
    expect(setPlaybackQueue).toHaveBeenCalledWith([]);
  });

  test('applies stored playback settings to state and TrackPlayer', async () => {
    const stored: StoredMusicHydrationState = {
      songs: null,
      playlists,
      eqEnabled: true,
      eqBands,
      eqPreset: 'rock',
      volume: 0.7,
      repeatMode: 'all',
      shuffle: true,
      currentSongId: null,
    };
    const setEqEnabledState = jest.fn();
    const setEqBandsState = jest.fn();
    const setEqPreset = jest.fn();
    const setVolumeState = jest.fn();
    const setRepeatMode = jest.fn();
    const setShuffle = jest.fn();

    await applyStoredPlaybackSettings({
      stored,
      setEqEnabledState,
      setEqBandsState,
      setEqPreset,
      setVolumeState,
      setRepeatMode,
      setShuffle,
    });

    expect(setEqEnabledState).toHaveBeenCalledWith(true);
    expect(setEqBandsState).toHaveBeenCalledWith(eqBands);
    expect(setEqPreset).toHaveBeenCalledWith('rock');
    expect(setVolumeState).toHaveBeenCalledWith(0.7);
    expect(setRepeatMode).toHaveBeenCalledWith('all');
    expect(setShuffle).toHaveBeenCalledWith(true);
    expect(TrackPlayer.setVolume).toHaveBeenCalledWith(0.7);
    expect(TrackPlayer.setRepeatMode).toHaveBeenCalled();
  });

  test('skips invalid stored eq band arrays when applying settings', async () => {
    const setEqBandsState = jest.fn();

    await applyStoredPlaybackSettings({
      stored: {
        songs: null,
        playlists: null,
        eqEnabled: null,
        eqBands: [1, 2, 3],
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: null,
        currentSongId: null,
      },
      setEqEnabledState: jest.fn(),
      setEqBandsState,
      setEqPreset: jest.fn(),
      setVolumeState: jest.fn(),
      setRepeatMode: jest.fn(),
      setShuffle: jest.fn(),
    });

    expect(setEqBandsState).not.toHaveBeenCalled();
  });

  test('does not commit playback state until stored native writes finish', async () => {
    let resolveVolume!: () => void;
    (TrackPlayer.setVolume as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => {
      resolveVolume = resolve;
    }));
    const setVolumeState = jest.fn();
    const setRepeatMode = jest.fn();

    const applying = applyStoredPlaybackSettings({
      stored: {
        songs: null,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: 0.65,
        repeatMode: 'all',
        shuffle: null,
        currentSongId: null,
      },
      setEqEnabledState: jest.fn(),
      setEqBandsState: jest.fn(),
      setEqPreset: jest.fn(),
      setVolumeState,
      setRepeatMode,
      setShuffle: jest.fn(),
    });

    await Promise.resolve();
    expect(setVolumeState).not.toHaveBeenCalled();
    expect(setRepeatMode).not.toHaveBeenCalled();

    resolveVolume();
    await applying;
    expect(setVolumeState).toHaveBeenCalledWith(0.65);
    expect(setRepeatMode).toHaveBeenCalledWith('all');
  });

  test('runs full music hydration and marks provider ready', async () => {
    await storage.set(StorageKeys.SONGS, songs);
    await storage.set(StorageKeys.PLAYLISTS, playlists);
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');

    const songsRef = createSongRef();
    const queueContextRef = createSongRef();
    const baseQueueContextRef = createSongRef();
    const nativeQueueRef = createSongRef();
    const setIsReady = jest.fn();
    const setSongsState = jest.fn();
    const setPlaybackQueue = jest.fn();
    const setPlaylists = jest.fn();

    await runMusicHydration({
      songsRef,
      queueContextRef,
      baseQueueContextRef,
      nativeQueueRef,
      setIsReady,
      setSongsState,
      setCurrentSong: jest.fn(),
      setPlaybackQueue,
      setPlaylists,
      setEqEnabledState: jest.fn(),
      setEqBandsState: jest.fn(),
      setEqPreset: jest.fn(),
      setVolumeState: jest.fn(),
      setRepeatMode: jest.fn(),
      setShuffle: jest.fn(),
      isCancelled: () => false,
    });

    expect(setSongsState).toHaveBeenCalledWith(songs);
    expect(setPlaybackQueue).toHaveBeenCalledWith(songs);
    expect(setPlaylists).toHaveBeenCalledWith(playlists);
    expect(setIsReady).toHaveBeenCalledWith(true);
  });

  test('runMusicHydration keeps playlists normalized with normalized songs', async () => {
    await storage.set(StorageKeys.SONGS, [{ id: ' s1 ', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }]);
    await storage.set(StorageKeys.PLAYLISTS, [{ id: 'pl-1', name: 'List', songIds: [' s1 ', 's1', 'missing', '   '], createdAt: 1, updatedAt: 1 }]);

    const setPlaylists = jest.fn();
    await runMusicHydration({
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef: createSongRef(),
      setIsReady: jest.fn(),
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      setPlaylists,
      setEqEnabledState: jest.fn(),
      setEqBandsState: jest.fn(),
      setEqPreset: jest.fn(),
      setVolumeState: jest.fn(),
      setRepeatMode: jest.fn(),
      setShuffle: jest.fn(),
      isCancelled: () => false,
    });

    expect(setPlaylists).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'pl-1', songIds: ['s1'] }),
    ]);
    await expect(storage.get(StorageKeys.PLAYLISTS)).resolves.toEqual([
      expect.objectContaining({ id: 'pl-1', songIds: ['s1'] }),
    ]);
  });


  test('hydrateStoredSongs runs cover cleanup after confirmed songs hydration state', async () => {
    await hydrateStoredSongs({
      stored: {
        songs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: null,
      },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef: createSongRef(),
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => false,
    });

    expect(cleanupCoverCache).toHaveBeenCalledWith(songs);
  });

  test('rescopes confirmed hydration protection before cleaning dropped song covers', async () => {
    const keptSong: Song = {
      id: 's1',
      title: 'One',
      artist: 'A',
      uri: 'file:///s1.mp3',
      cover: 'file:///docs/covers/aaa-bbb.jpg',
    };
    const droppedDuplicate: Song = {
      id: 's1',
      title: 'Duplicate',
      artist: 'A',
      uri: 'file:///duplicate.mp3',
      cover: 'file:///docs/covers/ccc-ddd.jpg',
    };
    const hydratedSongs = [keptSong];
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const setSongsState = jest.fn();

    await hydrateStoredSongs({
      stored: {
        songs: [keptSong, droppedDuplicate],
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: null,
      },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef: createSongRef(),
      setSongsState,
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => false,
    });

    const protection = (createCoverCacheProtection as jest.Mock).mock.results[0].value;
    expect(setSongsState).toHaveBeenCalledWith(hydratedSongs);
    expect(protection.protectSongCovers).toHaveBeenCalledWith([keptSong, droppedDuplicate]);
    expect(protection.replaceProtectedSongCovers).toHaveBeenCalledWith(hydratedSongs);
    expect(cleanupCoverCache).toHaveBeenCalledWith(hydratedSongs);
    expect(protection.replaceProtectedSongCovers.mock.invocationCallOrder[0]).toBeLessThan(
      (cleanupCoverCache as jest.Mock).mock.invocationCallOrder[0],
    );
    warn.mockRestore();
  });

  test('awaits hydrated cover cleanup before releasing confirmed protection', async () => {
    let resolveCleanup!: () => void;
    const cleanupResult = new Promise<void>(resolve => {
      resolveCleanup = resolve;
    });
    (cleanupCoverCache as jest.Mock).mockReturnValueOnce(cleanupResult);
    let hydrationResolved = false;

    const hydration = hydrateStoredSongs({
      stored: {
        songs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: null,
      },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef: createSongRef(),
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => false,
    }).then(() => {
      hydrationResolved = true;
    });

    await waitFor(() => expect(cleanupCoverCache).toHaveBeenCalledWith(songs));
    const protection = (createCoverCacheProtection as jest.Mock).mock.results[0].value;
    expect(protection.replaceProtectedSongCovers).toHaveBeenCalledWith(songs);
    expect(protection.replaceProtectedSongCovers.mock.invocationCallOrder[0]).toBeLessThan(
      (cleanupCoverCache as jest.Mock).mock.invocationCallOrder[0],
    );
    expect(hydrationResolved).toBe(false);
    expect(protection.release).not.toHaveBeenCalled();

    resolveCleanup();
    await hydration;

    expect(protection.release).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['returns false', undefined],
    ['rejects', new Error('write rejected')],
  ])('runMusicHydration continues without cleanup when normalized songs persistence %s', async (_label, writeError) => {
    const dirtySongs: Song[] = [{ id: ' s1 ', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }];
    await storage.set(StorageKeys.SONGS, dirtySongs);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const setSpy = jest.spyOn(storage, 'set');
    if (writeError) setSpy.mockRejectedValueOnce(writeError);
    else setSpy.mockResolvedValueOnce(false);
    const setSongsState = jest.fn();
    const setPlaybackQueue = jest.fn();
    const setIsReady = jest.fn();

    await runMusicHydration({
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef: createSongRef(),
      setIsReady,
      setSongsState,
      setCurrentSong: jest.fn(),
      setPlaybackQueue,
      setPlaylists: jest.fn(),
      setEqEnabledState: jest.fn(),
      setEqBandsState: jest.fn(),
      setEqPreset: jest.fn(),
      setVolumeState: jest.fn(),
      setRepeatMode: jest.fn(),
      setShuffle: jest.fn(),
      isCancelled: () => false,
    });

    expect(setSongsState).toHaveBeenCalledWith([expect.objectContaining({ id: 's1' })]);
    expect(setSongsState).not.toHaveBeenCalledWith([]);
    expect(setPlaybackQueue).toHaveBeenCalledWith([]);
    expect(setIsReady).toHaveBeenCalledWith(true);
    expect(cleanupCoverCache).not.toHaveBeenCalled();
    const protection = (createCoverCacheProtection as jest.Mock).mock.results[0].value;
    expect(protection.replaceProtectedSongCovers).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[MusicHydration] Failed to confirm sanitized songs persistence.',
      writeError,
    );
    warn.mockRestore();
  });

  test('hands unconfirmed hydration protection off before a later cancellation return', async () => {
    const dirtySongs: Song[] = [{ id: ' s1 ', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }];
    let cancelled = false;
    jest.spyOn(storage, 'set').mockImplementationOnce(async () => {
      cancelled = true;
      return false;
    });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await hydrateStoredSongs({
      stored: {
        songs: dirtySongs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: null,
      },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef: createSongRef(),
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => cancelled,
    });

    const sanitizedSongs: Song[] = [{ id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }];
    const hydrationProtection = (createCoverCacheProtection as jest.Mock).mock.results[0].value;
    expect(hydrationProtection.release).not.toHaveBeenCalled();

    const persistenceLease = acquireSongCoverProtection(sanitizedSongs);
    expect(createCoverCacheProtection).toHaveBeenCalledTimes(1);
    persistenceLease.markPersisting();
    persistenceLease.finishPersistence({ status: 'stored' });
    expect(hydrationProtection.release).toHaveBeenCalledTimes(1);
  });

  test('hydrateStoredSongs does not persist songs when unchanged', async () => {
    const setSpy = jest.spyOn(storage, 'set');
    await hydrateStoredSongs({
      stored: {
        songs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: null,
      },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef: createSongRef(),
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => false,
    });

    expect(setSpy).not.toHaveBeenCalledWith(StorageKeys.SONGS, expect.anything());
  });

  test('hydrateStoredSongs persists songs when ids are normalized or blank ids removed', async () => {
    const setSpy = jest.spyOn(storage, 'set');
    await hydrateStoredSongs({
      stored: {
        songs: [
          { id: ' s1 ', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
          { id: '   ', title: 'Blank', artist: 'A', uri: 'file:///blank.mp3' },
        ],
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: null,
      },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef: createSongRef(),
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => false,
    });

    expect(setSpy).toHaveBeenCalledWith(StorageKeys.SONGS, [
      expect.objectContaining({ id: 's1' }),
    ]);
  });

  

  test('hydrateStoredSongs deduplicates normalized ids across songs, queues, and native queue', async () => {
    const dupSongs: Song[] = [
      { id: 's1', title: 'First', artist: 'A', uri: 'file:///s1-a.mp3' },
      { id: ' s1 ', title: 'Second', artist: 'A', uri: 'file:///s1-b.mp3' },
      { id: 's2', title: 'Third', artist: 'A', uri: 'file:///s2.mp3' },
    ];
    const songsRef = createSongRef();
    const queueContextRef = createSongRef();
    const baseQueueContextRef = createSongRef();
    const nativeQueueRef = createSongRef();
    const setSongsState = jest.fn();
    const setPlaybackQueue = jest.fn();

    await hydrateStoredSongs({
      stored: {
        songs: dupSongs,
        playlists: [{ id: 'pl-1', name: 'List', songIds: [' s1 ', 's1', 's2'], createdAt: 1, updatedAt: 1 }],
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: ' s1 ',
      },
      songsRef,
      queueContextRef,
      baseQueueContextRef,
      nativeQueueRef,
      setSongsState,
      setCurrentSong: jest.fn(),
      setPlaybackQueue,
      isCancelled: () => false,
    });

    expect(songsRef.current.map(song => song.id)).toEqual(['s1', 's2']);
    expect(new Set(songsRef.current.map(song => song.id)).size).toBe(songsRef.current.length);
    expect(setSongsState).toHaveBeenCalledWith([
      expect.objectContaining({ id: 's1', uri: 'file:///s1-a.mp3' }),
      expect.objectContaining({ id: 's2' }),
    ]);
    expect(queueContextRef.current.map(song => song.id)).toEqual(['s1', 's2']);
    expect(baseQueueContextRef.current.map(song => song.id)).toEqual(['s1', 's2']);
    expect(nativeQueueRef.current.map(song => song.id)).toEqual(['s1', 's2']);
    expect(setPlaybackQueue).toHaveBeenCalledWith([
      expect.objectContaining({ id: 's1' }),
      expect.objectContaining({ id: 's2' }),
    ]);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBe('s1');
    await expect(storage.get(StorageKeys.PLAYLISTS)).resolves.toEqual([
      expect.objectContaining({ id: 'pl-1', songIds: ['s1', 's2'] }),
    ]);
  });

  test('hydrateStoredSongs keeps CURRENT_SONG_ID unchanged when already normalized and restored', async () => {
    const setSpy = jest.spyOn(storage, 'set');
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');
    const removeSpy = jest.spyOn(storage, 'remove');

    await hydrateStoredSongs({
      stored: { songs, playlists: null, eqEnabled: null, eqBands: null, eqPreset: null, volume: null, repeatMode: null, shuffle: false, currentSongId: 's1' },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef: createSongRef(),
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => false,
    });

    const currentSongIdWrites = setSpy.mock.calls.filter(([key]) => key === StorageKeys.CURRENT_SONG_ID);
    expect(currentSongIdWrites).toHaveLength(1);
    expect(removeSpy).not.toHaveBeenCalledWith(StorageKeys.CURRENT_SONG_ID);
  });

  test('hydrateStoredSongs removes whitespace-only CURRENT_SONG_ID', async () => {
    await storage.set(StorageKeys.CURRENT_SONG_ID, '   ');
    await hydrateStoredSongs({
      stored: { songs, playlists: null, eqEnabled: null, eqBands: null, eqPreset: null, volume: null, repeatMode: null, shuffle: false, currentSongId: '   ' },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef: createSongRef(),
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => false,
    });

    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
  });

  test('hydrateStoredSongs does not touch CURRENT_SONG_ID when null', async () => {
    const setSpy = jest.spyOn(storage, 'set');
    const removeSpy = jest.spyOn(storage, 'remove');
    await hydrateStoredSongs({
      stored: { songs, playlists: null, eqEnabled: null, eqBands: null, eqPreset: null, volume: null, repeatMode: null, shuffle: false, currentSongId: null },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef: createSongRef(),
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => false,
    });

    const currentSongIdWrites = setSpy.mock.calls.filter(([key]) => key === StorageKeys.CURRENT_SONG_ID);
    expect(currentSongIdWrites).toHaveLength(0);
    expect(removeSpy).not.toHaveBeenCalledWith(StorageKeys.CURRENT_SONG_ID);
  });

  test('runMusicHydration logs storage errors, preserves the library and publishes degraded', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const getSpy = jest.spyOn(storage, 'get').mockRejectedValueOnce(new Error('storage boom'));
    const setIsReady = jest.fn();
    const setSongsState = jest.fn();
    const setCurrentSong = jest.fn();
    const setPlaybackQueue = jest.fn();
    const setLibraryHydrationReady = jest.fn();
    const setHydrationStatus = jest.fn();
    const songsRef = createSongRef();
    songsRef.current = songs;

    await runMusicHydration({
      songsRef,
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef: createSongRef(),
      setIsReady,
      setLibraryHydrationReady,
      setHydrationStatus,
      setSongsState,
      setCurrentSong,
      setPlaybackQueue,
      setPlaylists: jest.fn(),
      setEqEnabledState: jest.fn(),
      setEqBandsState: jest.fn(),
      setEqPreset: jest.fn(),
      setVolumeState: jest.fn(),
      setRepeatMode: jest.fn(),
      setShuffle: jest.fn(),
      isCancelled: () => false,
    });

    expect(songsRef.current).toEqual(songs);
    expect(setSongsState).not.toHaveBeenCalled();
    expect(setPlaybackQueue).toHaveBeenCalledWith([]);
    expect(setCurrentSong).toHaveBeenCalledWith(null);
    expect(setIsReady).not.toHaveBeenCalled();
    expect(setLibraryHydrationReady).toHaveBeenLastCalledWith(false);
    expect(setHydrationStatus).toHaveBeenLastCalledWith('degraded');
    expect(warn).toHaveBeenCalledWith('[MusicHydration:StorageError] Failed to load stored hydration state.', expect.any(Error));
    getSpy.mockRestore();
  });

  test('runMusicHydration logs TrackPlayer reset fallback errors', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(storage, 'get').mockRejectedValueOnce(new Error('storage boom'));
    (TrackPlayer.reset as jest.Mock).mockRejectedValueOnce(new Error('reset boom'));

    await runMusicHydration({
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef: createSongRef(),
      setIsReady: jest.fn(),
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      setPlaylists: jest.fn(),
      setEqEnabledState: jest.fn(),
      setEqBandsState: jest.fn(),
      setEqPreset: jest.fn(),
      setVolumeState: jest.fn(),
      setRepeatMode: jest.fn(),
      setShuffle: jest.fn(),
      isCancelled: () => false,
    });

    expect(warn).toHaveBeenCalledWith(
      '[MusicHydration:TrackPlayerError] Failed to apply serialized hydration fallback.',
      expect.any(Error),
    );
  });

  test('runMusicHydration normalizes whitespace CURRENT_SONG_ID in storage', async () => {
    await storage.set(StorageKeys.SONGS, [{ id: ' s1 ', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }]);
    await storage.set(StorageKeys.CURRENT_SONG_ID, ' s1 ');

    await runMusicHydration({
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef: createSongRef(),
      setIsReady: jest.fn(),
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      setPlaylists: jest.fn(),
      setEqEnabledState: jest.fn(),
      setEqBandsState: jest.fn(),
      setEqPreset: jest.fn(),
      setVolumeState: jest.fn(),
      setRepeatMode: jest.fn(),
      setShuffle: jest.fn(),
      isCancelled: () => false,
    });

    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBe('s1');
  });

  test('post-mutation readback instability exhausts bounded retries without destructive fallback', async () => {
    await storage.set(StorageKeys.SONGS, songs);
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');
    await storage.set(StorageKeys.SHUFFLE, true);
    const forward = songs.map(song => ({ ...song, url: song.uri! }));
    let queueRead = 0;
    (TrackPlayer.getQueue as jest.Mock).mockImplementation(async () => {
      queueRead += 1;
      if (queueRead <= 2) return [];
      return queueRead % 2 === 0 ? [] : forward;
    });
    const retainedQueue = [{ id: 'logical', title: 'Logical', artist: 'A' }];
    const songsRef = createSongRef();
    const queueContextRef = { current: retainedQueue.slice() };
    const baseQueueContextRef = { current: retainedQueue.slice() };
    const nativeQueueRef = { current: retainedQueue.slice() };
    const setIsReady = jest.fn(); const setShuffle = jest.fn(); const setHydrationStatus = jest.fn();

    await runMusicHydration({
      songsRef, queueContextRef, baseQueueContextRef, nativeQueueRef, setIsReady, setHydrationStatus,
      setSongsState: jest.fn(), setCurrentSong: jest.fn(), setPlaybackQueue: jest.fn(),
      setPlaylists: jest.fn(), setEqEnabledState: jest.fn(), setEqBandsState: jest.fn(),
      setEqPreset: jest.fn(), setVolumeState: jest.fn(), setRepeatMode: jest.fn(), setShuffle,
      isCancelled: () => false,
    });

    expect(songsRef.current).toEqual(songs);
    expect(queueContextRef.current).toEqual(retainedQueue);
    expect(baseQueueContextRef.current).toEqual(retainedQueue);
    expect(nativeQueueRef.current).toEqual(retainedQueue);
    expect(TrackPlayer.reset).toHaveBeenCalledTimes(2);
    expect(setShuffle).not.toHaveBeenCalled();
    expect(setIsReady).not.toHaveBeenCalled();
    expect(setHydrationStatus).toHaveBeenCalledWith('degraded');
  });

  test('cancellation after an unstable post-mutation attempt starts no further retry mutation', async () => {
    await storage.set(StorageKeys.SONGS, songs);
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');
    const forward = songs.map(song => ({ ...song, url: song.uri! }));
    let queueRead = 0; let cancelled = false;
    (TrackPlayer.getQueue as jest.Mock).mockImplementation(async () => {
      queueRead += 1;
      if (queueRead <= 2) return [];
      return queueRead % 2 === 0 ? [] : forward;
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation((message: unknown) => {
      if (String(message).includes('ReadbackUnstable')) cancelled = true;
    });
    const setIsReady = jest.fn();
    await runMusicHydration({
      songsRef: createSongRef(), queueContextRef: createSongRef(), baseQueueContextRef: createSongRef(),
      nativeQueueRef: createSongRef(), setIsReady, setSongsState: jest.fn(), setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(), setPlaylists: jest.fn(), setEqEnabledState: jest.fn(),
      setEqBandsState: jest.fn(), setEqPreset: jest.fn(), setVolumeState: jest.fn(),
      setRepeatMode: jest.fn(), setShuffle: jest.fn(), isCancelled: () => cancelled,
    });
    expect(TrackPlayer.reset).toHaveBeenCalledTimes(2);
    expect(setIsReady).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test('post-mutation readback instability commits when the second hydration attempt is stable', async () => {
    await storage.set(StorageKeys.SONGS, songs);
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');
    const player = TrackPlayer as unknown as { __getQueue: () => Song[] };
    const forward = songs.map(song => ({ ...song, url: song.uri! }));
    let queueRead = 0;
    (TrackPlayer.getQueue as jest.Mock).mockImplementation(async () => {
      queueRead += 1;
      if (queueRead <= 2) return [];
      if (queueRead <= 26) return queueRead % 2 === 0 ? [] : forward;
      return player.__getQueue();
    });
    const queueContextRef = createSongRef(); const nativeQueueRef = createSongRef();
    const setIsReady = jest.fn(); const setPlaybackQueue = jest.fn(); const setHydrationStatus = jest.fn();
    await runMusicHydration({
      songsRef: createSongRef(), queueContextRef, baseQueueContextRef: createSongRef(), nativeQueueRef,
      setIsReady, setHydrationStatus, setSongsState: jest.fn(), setCurrentSong: jest.fn(), setPlaybackQueue,
      setPlaylists: jest.fn(), setEqEnabledState: jest.fn(), setEqBandsState: jest.fn(),
      setEqPreset: jest.fn(), setVolumeState: jest.fn(), setRepeatMode: jest.fn(),
      setShuffle: jest.fn(), isCancelled: () => false,
    });
    expect(queueContextRef.current).toEqual([]);
    expect(nativeQueueRef.current).toEqual([]);
    expect(setPlaybackQueue).toHaveBeenCalledWith([]);
    expect(TrackPlayer.reset).toHaveBeenCalledTimes(2);
    expect(setIsReady).not.toHaveBeenCalled();
    expect(setHydrationStatus).toHaveBeenCalledWith('retry-required');
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBe('s1');
  });

  test('does not mark provider ready when hydration is cancelled', async () => {
    const setIsReady = jest.fn();

    await runMusicHydration({
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef: createSongRef(),
      setIsReady,
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      setPlaylists: jest.fn(),
      setEqEnabledState: jest.fn(),
      setEqBandsState: jest.fn(),
      setEqPreset: jest.fn(),
      setVolumeState: jest.fn(),
      setRepeatMode: jest.fn(),
      setShuffle: jest.fn(),
      isCancelled: () => true,
    });

    expect(setIsReady).not.toHaveBeenCalled();
  });
});

test('superseded hydration settings never overwrite the newer shuffle intent', async () => {
  const setShuffle = jest.fn();
  await applyStoredPlaybackSettings({
    stored: { songs: [], playlists: null, eqEnabled: null, eqBands: null, eqPreset: null,
      volume: null, repeatMode: null, shuffle: false, currentSongId: null },
    setEqEnabledState: jest.fn(), setEqBandsState: jest.fn(), setEqPreset: jest.fn(),
    setVolumeState: jest.fn(), setRepeatMode: jest.fn(), setShuffle,
    skipShuffle: true,
  });
  expect(setShuffle).not.toHaveBeenCalled();
});
