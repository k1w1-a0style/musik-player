import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import {
  applyStoredPlaybackSettings,
  hydrateStoredSongs,
  loadStoredMusicHydrationState,
  runMusicHydration,
  type StoredMusicHydrationState,
} from '../musicHydrationHelpers';
import { StorageKeys, storage } from '../../utils/storage';
import type { Playlist, Song } from '../../types/Song';

const songs: Song[] = [{ id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }];
const playlists: Playlist[] = [{ id: 'pl-1', name: 'List', songIds: ['s1'], createdAt: 1 }];
const createSongRef = () => ({ current: [] as Song[] });

describe('musicHydrationHelpers', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  test('loads stored music hydration state', async () => {
    await storage.set(StorageKeys.SONGS, songs);
    await storage.set(StorageKeys.PLAYLISTS, playlists);
    await storage.set(StorageKeys.EQ_ENABLED, true);
    await storage.set(StorageKeys.EQ_BANDS, [1, 2, 3]);
    await storage.set(StorageKeys.EQ_PRESET, 'rock');
    await storage.set(StorageKeys.VOLUME, 0.7);
    await storage.set(StorageKeys.REPEAT_MODE, 'all');
    await storage.set(StorageKeys.SHUFFLE, true);
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');

    await expect(loadStoredMusicHydrationState()).resolves.toEqual({
      songs,
      playlists,
      eqEnabled: true,
      eqBands: [1, 2, 3],
      eqPreset: 'rock',
      volume: 0.7,
      repeatMode: 'all',
      shuffle: true,
      currentSongId: 's1',
    });
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

  test('applies stored playback settings to state and TrackPlayer', () => {
    const stored: StoredMusicHydrationState = {
      songs: null,
      playlists,
      eqEnabled: true,
      eqBands: [1, 2, 3],
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
    expect(setEqBandsState).toHaveBeenCalledWith([1, 2, 3]);
    expect(setEqPreset).toHaveBeenCalledWith('rock');
    expect(setVolumeState).toHaveBeenCalledWith(0.7);
    expect(setRepeatMode).toHaveBeenCalledWith('all');
    expect(setShuffle).toHaveBeenCalledWith(true);
    expect(TrackPlayer.setVolume).toHaveBeenCalledWith(0.7);
    expect(TrackPlayer.setRepeatMode).toHaveBeenCalled();
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
