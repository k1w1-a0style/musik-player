import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, { State } from 'react-native-track-player';
import type { Song } from '../../types/Song';
import { resetNativeQueueMutationLockForTests, runExclusiveNativeQueueReplacement } from '../../utils/nativeQueueMutationLock';
import { runInsertSongQueueAction, runPlaySongQueueAction, runShuffleQueueAction } from '../playbackQueueActionHelpers';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///1.mp3' },
  { id: 's2', title: 'Two', artist: 'A', uri: 'file:///2.mp3' },
  { id: 's3', title: 'Three', artist: 'A', uri: 'file:///3.mp3' },
];
const extra: Song = { id: 's4', title: 'Four', artist: 'A', uri: 'file:///4.mp3' };
const ref = (current: Song[] = []) => ({ current });
const args = (queue: Song[] = songs) => ({
  songsRef: ref([...songs, extra]), queueContextRef: ref(queue.slice()), baseQueueContextRef: ref(queue.slice()),
  nativeQueueRef: ref(queue.slice()), setPlaybackQueue: jest.fn(), setCurrentSong: jest.fn(),
  shuffle: false, shuffleRef: { current: false }, setShuffle: jest.fn(),
});
const player = TrackPlayer as unknown as {
  __reset: () => void; __getQueue: () => Song[]; __getActiveTrackIndex: () => number; __getState: () => State;
};
const restoreNativeMocks = () => {
  (TrackPlayer.getQueue as jest.Mock).mockImplementation(async () => player.__getQueue());
  (TrackPlayer.getActiveTrack as jest.Mock).mockImplementation(async () => player.__getQueue()[player.__getActiveTrackIndex()]);
  (TrackPlayer.getActiveTrackIndex as jest.Mock).mockImplementation(async () => player.__getActiveTrackIndex() >= 0 ? player.__getActiveTrackIndex() : undefined);
  (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 0 });
  (TrackPlayer.getPlaybackState as jest.Mock).mockImplementation(async () => ({ state: player.__getState() }));
};
const seed = async (queue: Song[], index = 0) => {
  player.__reset(); restoreNativeMocks();
  if (queue.length) await TrackPlayer.add(queue.map(song => ({ ...song, url: song.uri! })));
  if (queue.length && index !== 0) await TrackPlayer.skip(index);
  jest.clearAllMocks(); restoreNativeMocks();
};
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

beforeEach(async () => {
  resetNativeQueueMutationLockForTests();
  await AsyncStorage.clear();
  await seed([]);
});

test('Play: add succeeds and skip fails, then reconciles native truth', async () => {
  const input = args([]);
  (TrackPlayer.skip as jest.Mock).mockRejectedValueOnce(new Error('skip failed'));
  const result = await runPlaySongQueueAction({ ...input, song: songs[1] });
  expect(result.status).toBe('reconciled');
  expect(input.queueContextRef.current).toEqual([...songs, extra]);
  expect(input.setCurrentSong).toHaveBeenCalledWith(songs[0]);
});

test('Play: add succeeds and seekTo fails, then reconciles native truth', async () => {
  const input = args([]);
  (TrackPlayer.seekTo as jest.Mock).mockRejectedValueOnce(new Error('seek failed'));
  const result = await runPlaySongQueueAction({ ...input, song: songs[0] });
  expect(result.status).toBe('reconciled');
  expect(input.nativeQueueRef.current).toEqual([...songs, extra]);
});

test('Play: add succeeds and play fails, then reconciles native truth', async () => {
  const input = args([]);
  (TrackPlayer.play as jest.Mock).mockRejectedValueOnce(new Error('play failed'));
  const result = await runPlaySongQueueAction({ ...input, song: songs[0] });
  expect(result.status).toBe('reconciled');
  expect(input.queueContextRef.current).toEqual([...songs, extra]);
});

test('Insert reject without native side effect excludes the song from base queue', async () => {
  await seed(songs.slice(0, 2));
  const input = args(songs.slice(0, 2));
  (TrackPlayer.add as jest.Mock).mockRejectedValueOnce(new Error('add failed'));
  const result = await runInsertSongQueueAction({ ...input, song: extra, position: 'end', currentSongId: 's1' });
  expect(result.status).toBe('reconciled');
  expect(input.baseQueueContextRef.current).toEqual(songs.slice(0, 2));
});

test('Insert mutation followed by rejection includes only confirmed native insertion', async () => {
  await seed(songs.slice(0, 2));
  const input = args(songs.slice(0, 2));
  const add = (TrackPlayer.add as jest.Mock).getMockImplementation()!;
  (TrackPlayer.add as jest.Mock).mockImplementationOnce(async (...callArgs: unknown[]) => {
    await add(...callArgs); throw new Error('ack failed');
  });
  const result = await runInsertSongQueueAction({ ...input, song: extra, position: 'next', currentSongId: 's1' });
  expect(result.status).toBe('reconciled');
  expect(input.queueContextRef.current.map(song => song.id)).toEqual(['s1', 's4', 's2']);
});

test('Insert while shuffled preserves the confirmed semantic base multiset', async () => {
  const shuffled = [songs[1], songs[0], songs[2]];
  await seed(shuffled, 1);
  const input = args(shuffled); input.baseQueueContextRef.current = songs.slice(); input.shuffle = true; input.shuffleRef.current = true;
  const result = await runInsertSongQueueAction({ ...input, song: extra, position: 'end', currentSongId: 's1' });
  expect(result.status).toBe('applied');
  expect(new Set(input.baseQueueContextRef.current.map(song => song.id))).toEqual(new Set(['s1', 's2', 's3', 's4']));
});

test('missing active track remains null after insert', async () => {
  await seed([]);
  const input = args([]);
  await runInsertSongQueueAction({ ...input, song: songs[0], position: 'end' });
  expect(input.setCurrentSong).toHaveBeenCalledWith(songs[0]);
  // TrackPlayer add activates index zero; the committed song is native truth, not a fallback.
  expect(input.nativeQueueRef.current).toEqual([songs[0]]);
});

test('a direct second insert starts from recovered native truth', async () => {
  await seed([songs[0]]);
  const input = args([songs[0]]);
  (TrackPlayer.add as jest.Mock).mockRejectedValueOnce(new Error('first failed'));
  await runInsertSongQueueAction({ ...input, song: songs[1], position: 'end' });
  const second = await runInsertSongQueueAction({ ...input, song: songs[2], position: 'end' });
  expect(second.status).toBe('applied');
  expect(input.queueContextRef.current).toEqual([songs[0], songs[2]]);
});

test('shuffle recovery blocks a newer replacement through readback and persistence', async () => {
  await seed(songs);
  const input = args();
  const started = deferred(); const release = deferred();
  (TrackPlayer.getQueue as jest.Mock).mockImplementationOnce(async () => player.__getQueue())
    .mockImplementationOnce(async () => { started.resolve(); await release.promise; return player.__getQueue(); });
  (TrackPlayer.play as jest.Mock).mockRejectedValueOnce(new Error('play failed'));
  const shuffle = runShuffleQueueAction({ ...input, currentSongId: 's1' });
  await started.promise;
  let newerStarted = false;
  const newer = runExclusiveNativeQueueReplacement(async () => { newerStarted = true; });
  expect(newerStarted).toBe(false);
  release.resolve();
  await Promise.all([shuffle, newer]);
  expect(newerStarted).toBe(true);
});
