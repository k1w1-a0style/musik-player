import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import { runMusicHydration } from '../musicHydrationHelpers';
import { StorageKeys, storage } from '../../utils/storage';
import type { Song } from '../../types/Song';

const songs: Song[] = [{ id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }];
const createSongRef = () => ({ current: [] as Song[] });

const createRunMusicHydrationArgs = (isCancelled: () => boolean) => ({
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
  isCancelled,
});

describe('music hydration failure fallback readiness', () => {
  beforeEach(async () => {
    (TrackPlayer as unknown as { __reset: () => void }).__reset();
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
    warn.mockRestore();
    removeSpy.mockRestore();
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
    expect(warn).toHaveBeenCalledWith(
      '[MusicHydration:TrackPlayerError] Failed to apply serialized hydration fallback.',
      expect.any(Error),
    );
    warn.mockRestore();
  });

  test('routes an unverified native hydration result through fallback and withholds readiness when fallback also fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await storage.set(StorageKeys.SONGS, songs);
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');
    const args = createRunMusicHydrationArgs(() => false);

    (TrackPlayer.reset as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('rollback reset boom'))
      .mockRejectedValueOnce(new Error('fallback reset boom'));
    (TrackPlayer.add as jest.Mock).mockRejectedValueOnce(new Error('add boom'));
    (TrackPlayer.getQueue as jest.Mock)
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('initial readback boom'))
      .mockRejectedValueOnce(new Error('final readback boom'));

    await runMusicHydration(args);

    expect(args.setIsReady).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[MusicHydration:TrackPlayerError] Native queue hydration did not produce a verified state.',
      expect.any(Error),
    );
    expect(warn).toHaveBeenCalledWith(
      '[MusicHydration:TrackPlayerError] Failed to apply serialized hydration fallback.',
      expect.any(Error),
    );
    warn.mockRestore();
  });
});
