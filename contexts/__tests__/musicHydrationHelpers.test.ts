import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitFor } from '@testing-library/react-native';
import TrackPlayer from 'react-native-track-player';
import {
  applyStoredPlaybackSettings,
  hydrateStoredSongs,
  loadStoredMusicHydrationState,
  runMusicHydration,
  sanitizeStoredPlaylistsForHydration,
  type StoredMusicHydrationState,
} from '../musicHydrationHelpers';
import { StorageKeys, storage } from '../../utils/storage';
import type { Playlist, Song } from '../../types/Song';
import {
  resetNativeQueueMutationLockForTests,
  runExclusiveNativeQueueReplacement,
} from '../../utils/nativeQueueMutationLock';
import { seekToMillis } from '../playbackControlHelpers';

const mockMigrateLegacySongFavoritesFromStoredSongs = jest.fn();

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

describe('musicHydrationHelpers', () => {
  beforeEach(async () => {
    resetNativeQueueMutationLockForTests();
    await AsyncStorage.clear();
    jest.clearAllMocks();
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

    expect(setCurrentSong).not.toHaveBeenCalled();
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
    expect(queueContextRef.current).toEqual(songs);
    expect(baseQueueContextRef.current).toEqual(songs);
    expect(setPlaybackQueue).toHaveBeenCalledWith(songs);
    expect(nativeQueueRef.current.map(song => song.id)).toEqual(['native']);
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

  test('keeps native queue ref when reset fails while clearing a malformed restored song', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const malformedSongs: Song[] = [
      { id: 's1', title: 'One', artist: 'A', uri: '   ' },
      { id: 's2', title: 'Two', artist: 'A', uri: 'file:///s2.mp3' },
    ];
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');
    (TrackPlayer.reset as jest.Mock).mockRejectedValueOnce(new Error('reset failed'));
    const nativeQueueRef = createSongRef();
    nativeQueueRef.current = [{ id: 'stale', title: 'Stale', artist: 'A', uri: 'file:///stale.mp3' }];

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
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => false,
    });

    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
    expect(nativeQueueRef.current).toEqual([{ id: 'stale', title: 'Stale', artist: 'A', uri: 'file:///stale.mp3' }]);
    expect(warn).toHaveBeenCalledWith(
      '[PlaybackQueue] Failed to reset native queue after dropping malformed restored song.',
      expect.any(Error),
    );
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

  test('hydrated native queue add is not invalidated by queued playback control after reset', async () => {
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
    await waitFor(() => expect(TrackPlayer.seekTo).toHaveBeenCalledWith(5));
  });

  test('sets native queue ref when hydrated add succeeds before a newer replacement intent is observed', async () => {
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
    expect(nativeQueueRef.current.map(song => song.id)).toEqual(['s1']);
  });

  test('sets native queue ref immediately after hydrated native add even when cancelled afterwards', async () => {
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
    expect(nativeQueueRef.current.map(song => song.id)).toEqual(['s1']);
  });

  test('clears native queue ref when hydrated native queue initialization fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const nativeQueueRef = createSongRef();
    nativeQueueRef.current = songs.slice();
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
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef,
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => false,
    });

    expect(nativeQueueRef.current).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      '[PlaybackQueue] Failed to initialize hydrated native queue.',
      expect.any(Error),
    );
  });

  test('applies stored playback settings to state and TrackPlayer', () => {
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
    const setPlaylists = jest.fn();
    const setEqEnabledState = jest.fn();
    const setEqBandsState = jest.fn();
    const setEqPreset = jest.fn();
    const setVolumeState = jest.fn();
    const setRepeatMode = jest.fn();
    const setShuffle = jest.fn();

    applyStoredPlaybackSettings({
      stored,
      setPlaylists,
      setEqEnabledState,
      setEqBandsState,
      setEqPreset,
      setVolumeState,
      setRepeatMode,
      setShuffle,
    });

    expect(setPlaylists).toHaveBeenCalledWith(playlists);
    expect(setEqEnabledState).toHaveBeenCalledWith(true);
    expect(setEqBandsState).toHaveBeenCalledWith(eqBands);
    expect(setEqPreset).toHaveBeenCalledWith('rock');
    expect(setVolumeState).toHaveBeenCalledWith(0.7);
    expect(setRepeatMode).toHaveBeenCalledWith('all');
    expect(setShuffle).toHaveBeenCalledWith(true);
    expect(TrackPlayer.setVolume).toHaveBeenCalledWith(0.7);
    expect(TrackPlayer.setRepeatMode).toHaveBeenCalled();
  });

  test('persists sanitized playlists when applying stored playback settings', async () => {
    const dirtyPlaylist = { id: 'pl-1', name: 'Dirty', songIds: ['s1', 'missing', 's1'], createdAt: 1, updatedAt: 1 };
    const setPlaylists = jest.fn();

    applyStoredPlaybackSettings({
      stored: {
        songs,
        playlists: [dirtyPlaylist],
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: null,
        currentSongId: null,
      },
      setPlaylists,
      setEqEnabledState: jest.fn(),
      setEqBandsState: jest.fn(),
      setEqPreset: jest.fn(),
      setVolumeState: jest.fn(),
      setRepeatMode: jest.fn(),
      setShuffle: jest.fn(),
    });

    await expect(storage.get<Playlist[]>(StorageKeys.PLAYLISTS)).resolves.toEqual([
      expect.objectContaining({ id: 'pl-1', name: 'Dirty', songIds: ['s1'], createdAt: 1, updatedAt: expect.any(Number) }),
    ]);
    expect(setPlaylists).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'pl-1', name: 'Dirty', songIds: ['s1'], createdAt: 1, updatedAt: expect.any(Number) }),
    ]);
  });

  test('skips invalid stored eq band arrays when applying settings', () => {
    const setEqBandsState = jest.fn();

    applyStoredPlaybackSettings({
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
      setPlaylists: jest.fn(),
      setEqEnabledState: jest.fn(),
      setEqBandsState,
      setEqPreset: jest.fn(),
      setVolumeState: jest.fn(),
      setRepeatMode: jest.fn(),
      setShuffle: jest.fn(),
    });

    expect(setEqBandsState).not.toHaveBeenCalled();
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
    await expect(storage.get<Playlist[]>(StorageKeys.PLAYLISTS)).resolves.toEqual([
      expect.objectContaining({ id: 'pl-1', songIds: ['s1'] }),
    ]);
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
    await expect(storage.get<Playlist[]>(StorageKeys.PLAYLISTS)).resolves.toEqual([
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

  test('runMusicHydration logs storage load errors, applies fallback and marks provider ready', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const getSpy = jest.spyOn(storage, 'get').mockRejectedValueOnce(new Error('storage boom'));
    const setIsReady = jest.fn();
    const setSongsState = jest.fn();
    const setCurrentSong = jest.fn();
    const setPlaybackQueue = jest.fn();

    await runMusicHydration({
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef: createSongRef(),
      setIsReady,
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

    expect(setSongsState).toHaveBeenCalledWith([]);
    expect(setPlaybackQueue).toHaveBeenCalledWith([]);
    expect(setCurrentSong).toHaveBeenCalledWith(null);
    expect(setIsReady).toHaveBeenCalledWith(true);
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
      '[MusicHydration:TrackPlayerError] Failed to reset native queue after hydration failure.',
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
