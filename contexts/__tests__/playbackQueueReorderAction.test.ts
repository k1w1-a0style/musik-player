import TrackPlayer from 'react-native-track-player';
import { runReorderQueueAction } from '../playbackQueueActionHelpers';
import { resetNativeQueueMutationLockForTests } from '../../utils/nativeQueueMutationLock';
import type { Song } from '../../types/Song';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Two', artist: 'A', uri: 'file:///s2.mp3' },
  { id: 's3', title: 'Three', artist: 'A', uri: 'file:///s3.mp3' },
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
