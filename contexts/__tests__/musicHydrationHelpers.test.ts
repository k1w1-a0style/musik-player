import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import {
  applyStoredPlaybackSettings,
  loadStoredMusicHydrationState,
  type StoredMusicHydrationState,
} from '../musicHydrationHelpers';
import { StorageKeys, storage } from '../../utils/storage';
import type { Playlist, Song } from '../../types/Song';

const songs: Song[] = [{ id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }];
const playlists: Playlist[] = [{ id: 'pl-1', name: 'List', songIds: ['s1'], createdAt: 1 }];

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
});
