import TrackPlayer, { State } from 'react-native-track-player';
import type { Song } from '../../types/Song';
import { resetNativeQueueMutationLockForTests } from '../../utils/nativeQueueMutationLock';
import { runReorderQueueAction, runShuffleQueueAction } from '../playbackQueueActionHelpers';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///1.mp3' },
  { id: 's2', title: 'Two', artist: 'A', uri: 'file:///2.mp3' },
  { id: 's3', title: 'Three', artist: 'A', uri: 'file:///3.mp3' },
];
const ref = (current: Song[] = []) => ({ current });
const player = TrackPlayer as unknown as { __reset: () => void; __getQueue: () => Song[]; __getActiveTrackIndex: () => number;
  __getState: () => State; __setState: (state: State) => void; __setPlayWhenReady: (value: boolean) => void };
const mutations = {
  reset: (TrackPlayer.reset as jest.Mock).getMockImplementation(), add: (TrackPlayer.add as jest.Mock).getMockImplementation(),
  play: (TrackPlayer.play as jest.Mock).getMockImplementation(), pause: (TrackPlayer.pause as jest.Mock).getMockImplementation(),
  stop: (TrackPlayer.stop as jest.Mock).getMockImplementation(), skip: (TrackPlayer.skip as jest.Mock).getMockImplementation(),
  seekTo: (TrackPlayer.seekTo as jest.Mock).getMockImplementation(), move: (TrackPlayer.move as jest.Mock).getMockImplementation(),
};
const restore = () => {
  (TrackPlayer.getQueue as jest.Mock).mockImplementation(async () => player.__getQueue());
  (TrackPlayer.getActiveTrack as jest.Mock).mockImplementation(async () => player.__getQueue()[player.__getActiveTrackIndex()]);
  (TrackPlayer.getActiveTrackIndex as jest.Mock).mockImplementation(async () => player.__getActiveTrackIndex() >= 0 ? player.__getActiveTrackIndex() : undefined);
  (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 42 });
  (TrackPlayer.getPlaybackState as jest.Mock).mockImplementation(async () => ({ state: player.__getState() }));
  (TrackPlayer.getPlayWhenReady as jest.Mock).mockImplementation(async () => (
    TrackPlayer as unknown as { __getPlayWhenReady: () => boolean }
  ).__getPlayWhenReady());
};
const seed = async (queue: Song[], index = 0) => {
  for (const [method, implementation] of Object.entries(mutations)) (TrackPlayer[method as keyof typeof mutations] as jest.Mock).mockImplementation(implementation);
  player.__reset(); restore(); await TrackPlayer.add(queue.map(song => ({ ...song, url: song.uri! })));
  if (index) await TrackPlayer.skip(index); jest.clearAllMocks(); restore();
};
const createArgs = (queue = songs) => ({
  songsRef: ref(songs), queueContextRef: ref(queue.slice()), baseQueueContextRef: ref(songs.slice()), nativeQueueRef: ref(queue.slice()),
  setPlaybackQueue: jest.fn(), setCurrentSong: jest.fn(), setShuffle: jest.fn(), shuffleRef: { current: false },
});

beforeEach(() => resetNativeQueueMutationLockForTests());

test('reorder commits a completely read-back native queue', async () => {
  await seed(songs);
  const input = createArgs();
  const result = await runReorderQueueAction({ ...input, fromIndex: 2, toIndex: 1, currentSongId: 's1', shuffle: false });
  expect(result.status).toBe('applied');
  expect(input.queueContextRef.current.map(song => song.id)).toEqual(['s1', 's3', 's2']);
  expect(input.setCurrentSong).toHaveBeenCalledWith(songs[0]);
  expect(TrackPlayer.move).toHaveBeenCalledWith(2, 1);
  expect(TrackPlayer.reset).not.toHaveBeenCalled();
  expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
});

test('reorder preserves paused playback instead of starting audio', async () => {
  await seed(songs);
  player.__setState(State.Paused);
  const input = createArgs();

  const result = await runReorderQueueAction({ ...input, fromIndex: 2, toIndex: 1, currentSongId: 's1', shuffle: false });

  expect(result.status).toBe('applied');
  expect(player.__getState()).toBe(State.Paused);
  expect(TrackPlayer.play).not.toHaveBeenCalled();
});

test('shuffle preserves stopped playback instead of starting audio', async () => {
  await seed(songs);
  player.__setState(State.Stopped);
  const input = createArgs();

  const result = await runShuffleQueueAction({ ...input, currentSongId: 's1', shuffle: false });

  expect(result.status).toBe('applied');
  expect(player.__getState()).toBe(State.Stopped);
  expect(TrackPlayer.play).not.toHaveBeenCalled();
});

test.each([State.Buffering, State.Loading])(
  'reorder leaves transient native playback state untouched while state is %s',
  async transientState => {
    await seed(songs);
    player.__setState(transientState);
    player.__setPlayWhenReady(true);
    const input = createArgs();

    const result = await runReorderQueueAction({
      ...input, fromIndex: 2, toIndex: 1, currentSongId: 's1', shuffle: false,
    });

    expect(result.status).toBe('applied');
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(TrackPlayer.pause).not.toHaveBeenCalled();
    expect(player.__getState()).toBe(transientState);
  },
);

test.each([State.Buffering, State.Loading])(
  'shuffle preserves paused intent while native state is %s',
  async transientState => {
    await seed(songs);
    player.__setState(transientState);
    player.__setPlayWhenReady(false);
    const input = createArgs();

    const result = await runShuffleQueueAction({ ...input, currentSongId: 's1', shuffle: false });

    expect(result.status).toBe('applied');
    expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(player.__getState()).toBe(State.Paused);
  },
);

test('reorder during shuffle preserves the semantic base after a post-mutation failure', async () => {
  const shuffled = [songs[1], songs[0], songs[2]];
  await seed(shuffled, 0);
  const input = createArgs(shuffled); input.shuffleRef.current = true;
  (TrackPlayer.move as jest.Mock).mockRejectedValueOnce(new Error('move failed'));
  const result = await runReorderQueueAction({ ...input, fromIndex: 2, toIndex: 1, currentSongId: 's2', shuffle: true });
  expect(['reconciled', 'rolled-back']).toContain(result.status);
  expect(new Set(input.baseQueueContextRef.current.map(song => song.id))).toEqual(new Set(songs.map(song => song.id)));
});

test('direct reorder after recovered insert uses the committed native truth', async () => {
  await seed(songs);
  const input = createArgs();
  (TrackPlayer.move as jest.Mock).mockRejectedValueOnce(new Error('first failed'));
  await runReorderQueueAction({ ...input, fromIndex: 2, toIndex: 1, currentSongId: 's1', shuffle: false });
  const second = await runReorderQueueAction({ ...input, fromIndex: 1, toIndex: 2, currentSongId: 's1', shuffle: false });
  expect(['applied', 'reconciled']).toContain(second.status);
  expect(input.nativeQueueRef.current).toEqual(input.queueContextRef.current);
});

test('later unshuffle after reorder recovery restores only the confirmed semantic base', async () => {
  const shuffled = [songs[1], songs[0], songs[2]];
  await seed(shuffled);
  const input = createArgs(shuffled); input.shuffleRef.current = true;
  (TrackPlayer.move as jest.Mock).mockRejectedValueOnce(new Error('reorder failed'));
  await runReorderQueueAction({ ...input, fromIndex: 2, toIndex: 1, currentSongId: 's2', shuffle: true });
  expect(input.shuffleRef.current).toBe(true);
  const unshuffle = await runShuffleQueueAction({ ...input, currentSongId: 's2', shuffle: true });
  expect(unshuffle.status).toBe('applied');
  expect(input.queueContextRef.current).toEqual(songs);
  expect(input.baseQueueContextRef.current).toEqual(songs);
  expect(input.shuffleRef.current).toBe(false);
});
