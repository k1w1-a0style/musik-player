import TrackPlayer from 'react-native-track-player';
import { createHydrationPlan } from '../musicHydrationPlan';
import { applyHydratedNativeQueue } from '../musicHydrationNativeQueue';
import { resetNativeQueueMutationLockForTests, runExclusiveNativeQueueReplacement } from '../../utils/nativeQueueMutationLock';
import type { Song } from '../../types/Song';

const songs: Song[] = [{ id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }];
const stored = {
  songs,
  playlists: null,
  eqEnabled: null,
  eqBands: null,
  eqPreset: null,
  volume: null,
  repeatMode: null,
  shuffle: false,
  currentSongId: 's1',
};
const createSongRef = () => ({ current: [] as Song[] });

describe('musicHydrationNativeQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetNativeQueueMutationLockForTests();
  });

  test('sets native queue ref immediately after TrackPlayer.add succeeds', async () => {
    const plan = createHydrationPlan(stored, songs);
    const nativeQueueRef = createSongRef();

    await applyHydratedNativeQueue({ plan, nativeQueueRef, isCancelled: () => false });

    expect(TrackPlayer.add).toHaveBeenCalledWith([expect.objectContaining({ id: 's1' })]);
    expect(nativeQueueRef.current.map(song => song.id)).toEqual(['s1']);
  });

  test('does not overwrite native queue ref when cancelled before reset', async () => {
    const plan = createHydrationPlan(stored, songs);
    const nativeQueueRef = createSongRef();
    nativeQueueRef.current = [{ id: 'stale', title: 'Stale', artist: 'A', uri: 'file:///stale.mp3' }];

    await applyHydratedNativeQueue({ plan, nativeQueueRef, isCancelled: () => true });

    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(TrackPlayer.add).not.toHaveBeenCalled();
    expect(nativeQueueRef.current.map(song => song.id)).toEqual(['stale']);
  });

  test('clears native queue ref when TrackPlayer.add fails after reset', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const plan = createHydrationPlan(stored, songs);
    const nativeQueueRef = createSongRef();
    nativeQueueRef.current = songs.slice();
    (TrackPlayer.add as jest.Mock).mockRejectedValueOnce(new Error('add failed'));

    await applyHydratedNativeQueue({ plan, nativeQueueRef, isCancelled: () => false });

    expect(nativeQueueRef.current).toEqual([]);
    expect(warn).toHaveBeenCalledWith('[PlaybackQueue] Failed to initialize hydrated native queue.', expect.any(Error));
    warn.mockRestore();
  });

  test('does not set native queue ref when add succeeds after a newer replacement is observed', async () => {
    const plan = createHydrationPlan(stored, songs);
    const nativeQueueRef = createSongRef();
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(async () => {
      void runExclusiveNativeQueueReplacement(async () => undefined);
    });

    await applyHydratedNativeQueue({ plan, nativeQueueRef, isCancelled: () => false });

    expect(nativeQueueRef.current).toEqual([]);
  });

  test('resets but does not add or play when hydration produces an empty native queue on first launch', async () => {
    const plan = createHydrationPlan({ ...stored, songs: [], currentSongId: null }, []);
    const nativeQueueRef = createSongRef();
    nativeQueueRef.current = songs.slice();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    await expect(applyHydratedNativeQueue({ plan, nativeQueueRef, isCancelled: () => false })).resolves.toBe(true);

    expect(TrackPlayer.reset).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.add).not.toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(nativeQueueRef.current).toEqual([]);
    // Legitimate empty state (no library songs) must not surface as a warning.
    expect(warn).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      '[PlaybackQueue] Hydration produced no playable songs (empty library / first launch).',
      expect.objectContaining({
        restoredQueueCount: 0,
        librarySongCount: 0,
        playableQueueCount: 0,
        reason: 'empty-library',
      }),
    );
    info.mockRestore();
    warn.mockRestore();
  });

  test('warns with counts when library has entries but none are playable', async () => {
    const unplayableSongs: Song[] = [
      { id: 'no-uri', title: 'No URI', artist: 'A' },
      { id: 'blank-uri', title: 'Blank', artist: 'B', uri: '   ' },
    ];
    const plan = createHydrationPlan(
      { ...stored, songs: unplayableSongs, currentSongId: null },
      unplayableSongs,
    );
    const nativeQueueRef = createSongRef();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    await expect(applyHydratedNativeQueue({ plan, nativeQueueRef, isCancelled: () => false })).resolves.toBe(true);

    expect(TrackPlayer.reset).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.add).not.toHaveBeenCalled();
    expect(nativeQueueRef.current).toEqual([]);
    expect(info).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[PlaybackQueue] Hydration produced no playable songs for native queue.',
      expect.objectContaining({
        librarySongCount: 2,
        playableQueueCount: 0,
        reason: 'no-playable-uris',
      }),
    );
    info.mockRestore();
    warn.mockRestore();
  });

});
