import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import { runMusicHydration } from '../musicHydrationHelpers';
import { StorageKeys, storage } from '../../utils/storage';
import type { Song } from '../../types/Song';

const createSongRef = () => ({ current: [] as Song[] });

const createRunMusicHydrationArgs = (isCancelled: () => boolean) => ({
  songsRef: createSongRef(),
  queueContextRef: createSongRef(),
  baseQueueContextRef: createSongRef(),
  nativeQueueRef: createSongRef(),
  setIsReady: jest.fn(),
  setHydrationStatus: jest.fn(),
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
  isCancelled,
});

describe('music hydration failure fallback readiness', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  test('marks provider ready after storage failure fallback applies safe empty state', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const removeSpy = jest.spyOn(storage, 'remove');
    jest.spyOn(storage, 'get').mockRejectedValueOnce(new Error('storage boom'));
    const args = createRunMusicHydrationArgs(() => false);

    await runMusicHydration(args);

    expect(args.songsRef.current).toEqual([]);
    expect(args.queueContextRef.current).toEqual([]);
    expect(args.baseQueueContextRef.current).toEqual([]);
    expect(args.nativeQueueRef.current).toEqual([]);
    expect(args.setSongsState).toHaveBeenCalledWith([]);
    expect(args.setPlaybackQueue).toHaveBeenCalledWith([]);
    expect(args.setCurrentSong).toHaveBeenCalledWith(null);
    expect(TrackPlayer.reset).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith(StorageKeys.CURRENT_SONG_ID);
    expect(args.setIsReady).toHaveBeenCalledWith(true);
    expect(args.setHydrationStatus).toHaveBeenLastCalledWith('ready');
    warn.mockRestore();
    removeSpy.mockRestore();
  });

  test('hydrates a missing SONGS key as a verified empty library and still applies stored settings', async () => {
    const oldSong: Song = { id: 'old', title: 'Old', artist: 'A', uri: 'file:///old.mp3' };
    await TrackPlayer.add([{ ...oldSong, url: oldSong.uri! }]);
    await storage.set(StorageKeys.CURRENT_SONG_ID, oldSong.id);
    await storage.set(StorageKeys.VOLUME, 0.25);
    await storage.set(StorageKeys.REPEAT_MODE, 'all');
    await storage.set(StorageKeys.SHUFFLE, true);
    await storage.set(StorageKeys.EQ_ENABLED, true);
    await storage.set(StorageKeys.EQ_BANDS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    await storage.set(StorageKeys.EQ_PRESET, 'rock');
    await storage.set(StorageKeys.PLAYLISTS, [{ id: 'p1', name: 'Empty profile list', songIds: ['old'], createdAt: 1, updatedAt: 1 }]);
    const args = createRunMusicHydrationArgs(() => false);
    args.nativeQueueRef.current = [oldSong];
    args.queueContextRef.current = [oldSong];
    args.baseQueueContextRef.current = [oldSong];

    await runMusicHydration(args);

    expect(await TrackPlayer.getQueue()).toEqual([]);
    expect(args.nativeQueueRef.current).toEqual([]);
    expect(args.queueContextRef.current).toEqual([]);
    expect(args.baseQueueContextRef.current).toEqual([]);
    expect(args.setPlaybackQueue).toHaveBeenCalledWith([]);
    expect(args.setCurrentSong).toHaveBeenCalledWith(null);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
    expect(args.setVolumeState).toHaveBeenCalledWith(0.25);
    expect(args.setRepeatMode).toHaveBeenCalledWith('all');
    expect(args.setShuffle).toHaveBeenLastCalledWith(true);
    expect(args.setEqEnabledState).toHaveBeenCalledWith(true);
    expect(args.setEqBandsState).toHaveBeenCalledWith([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(args.setEqPreset).toHaveBeenCalledWith('rock');
    expect(args.setPlaylists).toHaveBeenCalledWith([expect.objectContaining({ id: 'p1', songIds: ['old'] })]);
    expect(args.setIsReady).toHaveBeenCalledWith(true);
  });

  test('cancellation before missing-SONGS hydration starts no native reset', async () => {
    const args = createRunMusicHydrationArgs(() => true);
    await runMusicHydration(args);
    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(args.setIsReady).not.toHaveBeenCalled();
  });

  test('routes an unverified native hydration through fallback without applying playback settings', async () => {
    await storage.set(StorageKeys.SONGS, [{ id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }]);
    await storage.set(StorageKeys.VOLUME, 0.25);
    (TrackPlayer.getQueue as jest.Mock).mockRejectedValueOnce(new Error('snapshot unavailable'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const args = createRunMusicHydrationArgs(() => false);

    await runMusicHydration(args);

    expect(args.setVolumeState).not.toHaveBeenCalled();
    expect(args.setRepeatMode).not.toHaveBeenCalled();
    expect(args.nativeQueueRef.current).toEqual([]);
    expect(args.queueContextRef.current).toEqual([]);
    expect(args.baseQueueContextRef.current).toEqual([]);
    expect(args.setPlaybackQueue).toHaveBeenLastCalledWith([]);
    expect(args.setCurrentSong).toHaveBeenLastCalledWith(null);
    expect(args.setShuffle).toHaveBeenLastCalledWith(false);
    expect(args.setIsReady).toHaveBeenCalledWith(true);
    warn.mockRestore();
  });

  test('keeps provider not-ready when hydration failure flow is cancelled', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(storage, 'get').mockRejectedValueOnce(new Error('storage boom'));
    const args = createRunMusicHydrationArgs(() => true);

    await runMusicHydration(args);

    expect(args.setSongsState).not.toHaveBeenCalled();
    expect(args.setPlaybackQueue).not.toHaveBeenCalled();
    expect(args.setCurrentSong).not.toHaveBeenCalled();
    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(args.setIsReady).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test('keeps provider not-ready when serialized fallback cannot verify native reset', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(storage, 'get').mockRejectedValueOnce(new Error('storage boom'));
    (TrackPlayer.reset as jest.Mock).mockRejectedValueOnce(new Error('reset boom'));
    const args = createRunMusicHydrationArgs(() => false);

    await runMusicHydration(args);

    expect(args.nativeQueueRef.current).toEqual([]);
    expect(args.setIsReady).not.toHaveBeenCalled();
    expect(args.setHydrationStatus).toHaveBeenLastCalledWith('degraded');
    expect(args.setHydrationStatus).not.toHaveBeenCalledWith('ready');
    expect(warn).toHaveBeenCalledWith(
      '[MusicHydration:TrackPlayerError] Failed to apply serialized hydration fallback.',
      expect.any(Error),
    );
    warn.mockRestore();
  });

  test('publishes degraded without committing state when fallback readback fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(storage, 'get').mockRejectedValueOnce(new Error('storage boom'));
    (TrackPlayer.getQueue as jest.Mock).mockRejectedValueOnce(new Error('readback boom'));
    const args = createRunMusicHydrationArgs(() => false);

    await runMusicHydration(args);

    expect(args.setSongsState).not.toHaveBeenCalled();
    expect(args.setPlaybackQueue).not.toHaveBeenCalled();
    expect(args.setCurrentSong).not.toHaveBeenCalled();
    expect(args.setShuffle).not.toHaveBeenCalled();
    expect(args.setIsReady).not.toHaveBeenCalled();
    expect(args.setHydrationStatus).toHaveBeenLastCalledWith('degraded');
    expect(args.setHydrationStatus).not.toHaveBeenCalledWith('ready');
    warn.mockRestore();
  });

  test('does not publish or commit fallback result after cancellation', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(storage, 'get').mockRejectedValueOnce(new Error('storage boom'));
    let cancelled = false;
    const reset = (TrackPlayer.reset as jest.Mock).getMockImplementation()!;
    (TrackPlayer.reset as jest.Mock).mockImplementationOnce(async () => {
      await reset();
      cancelled = true;
    });
    const args = createRunMusicHydrationArgs(() => cancelled);

    await runMusicHydration(args);

    expect(args.setIsReady).not.toHaveBeenCalled();
    expect(args.setHydrationStatus).not.toHaveBeenCalled();
    expect(args.setSongsState).not.toHaveBeenCalled();
    expect(args.setPlaybackQueue).not.toHaveBeenCalled();
    expect(args.setCurrentSong).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
