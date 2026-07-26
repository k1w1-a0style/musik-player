import TrackPlayer from 'react-native-track-player';
import { runReorderQueueAction } from '../playbackQueueActionHelpers';
import { resetNativeQueueMutationLockForTests, runExclusiveNativeQueueReplacement } from '../../utils/nativeQueueMutationLock';
import type { Song } from '../../types/Song';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Two', artist: 'A', uri: 'file:///s2.mp3' },
  { id: 's3', title: 'Three', artist: 'A', uri: 'file:///s3.mp3' },
];
const longerQueue: Song[] = [
  ...songs,
  { id: 's4', title: 'Four', artist: 'A', uri: 'file:///s4.mp3' },
];

const createSongRef = (current: Song[] = []) => ({ current });
const createArgs = () => ({
  songsRef: createSongRef(songs),
  queueContextRef: createSongRef(songs.slice()),
  baseQueueContextRef: createSongRef(songs.slice()),
  nativeQueueRef: createSongRef(songs.slice()),
  setPlaybackQueue: jest.fn(),
  setCurrentSong: jest.fn(),
  setShuffle: jest.fn(),
});

describe('runReorderQueueAction', () => {
  beforeEach(() => {
    resetNativeQueueMutationLockForTests();
    jest.clearAllMocks();
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's1' });
    (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 42 });
  });

  test('moves upcoming queue items and syncs the native queue', async () => {
    const args = createArgs();

    await expect(runReorderQueueAction({
      ...args,
      fromIndex: 2,
      toIndex: 1,
      currentSongId: 's1',
      shuffle: false,
      setShuffle: args.setShuffle,
    })).resolves.toBe(true);

    expect(args.queueContextRef.current.map(song => song.id)).toEqual(['s1', 's3', 's2']);
    expect(args.baseQueueContextRef.current.map(song => song.id)).toEqual(['s1', 's3', 's2']);
    expect(args.setPlaybackQueue).toHaveBeenCalledWith([songs[0], songs[2], songs[1]]);
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(42);
    expect(TrackPlayer.play).toHaveBeenCalled();
  });

  test('preserves a later active track when rebuilding reordered queues', async () => {
    const args = createArgs();
    args.songsRef.current = longerQueue.slice();
    args.queueContextRef.current = longerQueue.slice();
    args.baseQueueContextRef.current = longerQueue.slice();
    args.nativeQueueRef.current = longerQueue.slice();
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's2' });

    await expect(runReorderQueueAction({
      ...args,
      fromIndex: 3,
      toIndex: 2,
      currentSongId: 's2',
      shuffle: false,
      setShuffle: args.setShuffle,
    })).resolves.toBe(true);

    expect(args.queueContextRef.current.map(song => song.id)).toEqual(['s1', 's2', 's4', 's3']);
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[1]);
    expect(TrackPlayer.skip).toHaveBeenCalledWith(1);
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(42);
  });

  test('keeps UI state unchanged and native ref truthful when native rebuild fails after reset', async () => {
    const args = createArgs();
    (TrackPlayer.add as jest.Mock).mockRejectedValueOnce(new Error('native add failed'));

    await expect(runReorderQueueAction({
      ...args,
      fromIndex: 2,
      toIndex: 1,
      currentSongId: 's1',
      shuffle: false,
      setShuffle: args.setShuffle,
    })).resolves.toBe(false);

    expect(args.queueContextRef.current).toEqual(songs);
    expect(args.baseQueueContextRef.current).toEqual(songs);
    expect(args.setPlaybackQueue).not.toHaveBeenCalled();
    expect(args.setCurrentSong).not.toHaveBeenCalled();
    expect(args.setShuffle).not.toHaveBeenCalled();
    expect(args.nativeQueueRef.current).toEqual([]);
  });

  test('commits no stale UI state when a newer replacement supersedes native add', async () => {
    const args = createArgs();
    let resolveAdd: () => void = () => undefined;
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => {
      resolveAdd = resolve;
    }));

    const reorderPromise = runReorderQueueAction({
      ...args,
      fromIndex: 2,
      toIndex: 1,
      currentSongId: 's1',
      shuffle: false,
      setShuffle: args.setShuffle,
    });
    for (let attempt = 0; attempt < 20 && !(TrackPlayer.add as jest.Mock).mock.calls.length; attempt += 1) {
      await Promise.resolve();
    }
    expect(TrackPlayer.add).toHaveBeenCalled();

    const newerNativeQueue = [songs[2]];
    const newerReplacement = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      expect(isCurrent()).toBe(true);
      args.nativeQueueRef.current = newerNativeQueue.slice();
    });
    resolveAdd();
    await Promise.all([reorderPromise, newerReplacement]);

    expect(args.queueContextRef.current).toEqual(songs);
    expect(args.baseQueueContextRef.current).toEqual(songs);
    expect(args.setPlaybackQueue).not.toHaveBeenCalled();
    expect(args.setCurrentSong).not.toHaveBeenCalled();
    expect(args.setShuffle).not.toHaveBeenCalled();
    expect(args.nativeQueueRef.current).toEqual(newerNativeQueue);
  });

  test('does not move the current track', async () => {
    const args = createArgs();

    await expect(runReorderQueueAction({
      ...args,
      fromIndex: 0,
      toIndex: 2,
      currentSongId: 's1',
      shuffle: false,
      setShuffle: args.setShuffle,
    })).resolves.toBe(false);

    expect(args.queueContextRef.current).toEqual(songs);
    expect(TrackPlayer.reset).not.toHaveBeenCalled();
  });
});
