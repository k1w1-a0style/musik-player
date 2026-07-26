import TrackPlayer, { State } from 'react-native-track-player';
import type { Song } from '../../types/Song';
import { storage } from '../../utils/storage';
import {
  createNativeQueueMutationSnapshot,
  deriveBaseQueue,
  executeNativeQueueRollback,
  hasSameNormalizedIdMultiset,
  persistNativeCurrentSong,
  readNativeQueueTruth,
  recoverNativeQueueMutation,
  verifyNativeQueueRollback,
  type NativeQueueMutationSnapshot,
} from '../nativeQueueRecovery';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///1.mp3' },
  { id: 's2', title: 'Two', artist: 'A', uri: 'file:///2.mp3' },
];
const ref = (current: Song[] = []) => ({ current });
const targets = () => ({
  nativeQueueRef: ref(), queueContextRef: ref(), baseQueueContextRef: ref(),
  setPlaybackQueue: jest.fn(), setCurrentSong: jest.fn(), setShuffle: jest.fn(), shuffleRef: { current: false },
});
const snapshot = (overrides: Partial<NativeQueueMutationSnapshot> = {}): NativeQueueMutationSnapshot => ({
  queue: songs, nativeQueue: songs, logicalQueue: songs, baseQueue: songs, currentSong: songs[0],
  activeSong: songs[0], activeTrackId: 's1', activeIndex: 0, progressSeconds: 0,
  shuffleEnabled: false, playbackState: 'paused', ...overrides,
});

beforeEach(() => {
  const player = TrackPlayer as unknown as { __reset: () => void; __getQueue: () => Song[]; __getActiveTrackIndex: () => number; __getState: () => State };
  player.__reset();
  (TrackPlayer.getQueue as jest.Mock).mockImplementation(async () => player.__getQueue());
  (TrackPlayer.getActiveTrack as jest.Mock).mockImplementation(async () => player.__getQueue()[player.__getActiveTrackIndex()]);
  (TrackPlayer.getActiveTrackIndex as jest.Mock).mockImplementation(async () => player.__getActiveTrackIndex() >= 0 ? player.__getActiveTrackIndex() : undefined);
  (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 0 });
  (TrackPlayer.getPlaybackState as jest.Mock).mockImplementation(async () => ({ state: player.__getState() }));
  jest.clearAllMocks();
});

test('readback reports the complete native state and active index zero', async () => {
  await TrackPlayer.add(songs.map(song => ({ ...song, url: song.uri! })));
  const result = await readNativeQueueTruth(songs);
  expect(result).toMatchObject({ activeSong: songs[0], activeTrackId: 's1', activeIndex: 0, playbackState: 'paused' });
});

test('readback never invents an active song', async () => {
  (TrackPlayer.getQueue as jest.Mock).mockResolvedValue(songs);
  (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue(undefined);
  (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(undefined);
  await expect(readNativeQueueTruth(songs)).resolves.toMatchObject({ activeSong: null, activeTrackId: null, activeIndex: -1 });
});

test('readback preserves an active index greater than zero', async () => {
  await TrackPlayer.add(songs.map(song => ({ ...song, url: song.uri! })));
  await TrackPlayer.skip(1);
  await expect(readNativeQueueTruth(songs)).resolves.toMatchObject({ activeSong: songs[1], activeIndex: 1 });
});

test('readback rejects unknown queue tracks', async () => {
  (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([{ id: 'unknown' }]);
  await expect(readNativeQueueTruth(songs)).rejects.toThrow('unknown track');
});

test('getQueue and getActiveTrack failures stay observable', async () => {
  (TrackPlayer.getQueue as jest.Mock).mockRejectedValueOnce(new Error('queue failed'));
  await expect(readNativeQueueTruth(songs)).rejects.toThrow('queue failed');
  (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([]);
  (TrackPlayer.getActiveTrack as jest.Mock).mockRejectedValueOnce(new Error('active failed'));
  await expect(readNativeQueueTruth(songs)).rejects.toThrow('active failed');
});

test('snapshot contains queue, current, progress, shuffle and playback state without reading storage', async () => {
  await TrackPlayer.add(songs.map(song => ({ ...song, url: song.uri! })));
  const storageSpy = jest.spyOn(storage, 'getCurrentSongId').mockRejectedValue(new Error('storage failed'));
  const result = await createNativeQueueMutationSnapshot({ knownSongs: songs, currentSong: songs[0], shuffleEnabled: true, targets: targets() });
  expect(result).toMatchObject({ nativeQueue: songs, currentSong: songs[0], activeIndex: 0, shuffleEnabled: true, playbackState: 'paused' });
  expect(storageSpy).not.toHaveBeenCalled();
});

test('ID multiset compares length and duplicate frequencies', () => {
  expect(hasSameNormalizedIdMultiset([{ ...songs[0] }, { ...songs[0] }], [{ ...songs[0] }, { ...songs[1] }])).toBe(false);
  expect(hasSameNormalizedIdMultiset([{ ...songs[0], id: ' s1 ' }, songs[1]], [songs[1], songs[0]])).toBe(true);
});

test('partial readback cannot retain absent base songs', () => {
  expect(deriveBaseQueue([songs[0]], songs)).toEqual([songs[0]]);
});

test.each([
  ['paused', State.Paused], ['playing', State.Playing], ['stopped', State.Stopped],
] as const)('rollback restores %s playback state, index zero and progress zero', async (playbackState, _state) => {
  await executeNativeQueueRollback(snapshot({ playbackState }));
  expect(TrackPlayer.skip).toHaveBeenCalledWith(0);
  expect(TrackPlayer.seekTo).toHaveBeenCalledWith(0);
  expect(TrackPlayer[playbackState === 'playing' ? 'play' : playbackState === 'paused' ? 'pause' : 'stop']).toHaveBeenCalled();
});

test('rollback handles an empty queue without inventing an active track', async () => {
  await executeNativeQueueRollback(snapshot({ queue: [], nativeQueue: [], activeSong: null, activeTrackId: null, activeIndex: -1 }));
  expect(TrackPlayer.add).not.toHaveBeenCalled();
  expect(TrackPlayer.skip).not.toHaveBeenCalled();
});

test('rollback verification checks order, active state, progress and playback', () => {
  expect(() => verifyNativeQueueRollback(snapshot(), { ...snapshot(), progressSeconds: 0.2 })).not.toThrow();
  expect(() => verifyNativeQueueRollback(snapshot(), { ...snapshot(), queue: [songs[1], songs[0]] })).toThrow('order');
  expect(() => verifyNativeQueueRollback(snapshot(), { ...snapshot(), activeIndex: 1 })).toThrow('index');
  expect(() => verifyNativeQueueRollback(snapshot(), { ...snapshot(), progressSeconds: 1 })).toThrow('progress');
});

test('known initial readback reconciles without rollback', async () => {
  const stateTargets = targets();
  (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([]);
  const result = await recoverNativeQueueMutation({ originalError: new Error('original'), snapshot: snapshot(), knownSongs: songs, librarySongs: songs, targets: stateTargets });
  expect(result.status).toBe('reconciled');
  expect(TrackPlayer.reset).not.toHaveBeenCalled();
});

test('unknown initial readback performs and verifies rollback', async () => {
  await TrackPlayer.add(songs.map(song => ({ ...song, url: song.uri! })));
  (TrackPlayer.getQueue as jest.Mock).mockRejectedValueOnce(new Error('initial'));
  const result = await recoverNativeQueueMutation({ originalError: new Error('original'), snapshot: snapshot(), knownSongs: songs, librarySongs: songs, targets: targets() });
  expect(result.status).toBe('rolled-back');
  expect(result.status === 'rolled-back' && result.diagnostics?.initialReadbackError).toBeInstanceOf(Error);
});

test('rollback verification mismatch falls through to a known final readback with diagnostics', async () => {
  (TrackPlayer.getQueue as jest.Mock)
    .mockRejectedValueOnce(new Error('initial'))
    .mockResolvedValueOnce([songs[1], songs[0]])
    .mockResolvedValueOnce(songs);
  const result = await recoverNativeQueueMutation({ originalError: new Error('original'), snapshot: snapshot(), knownSongs: songs, librarySongs: songs, targets: targets() });
  expect(result.status).toBe('reconciled');
  expect(result.status === 'reconciled' && result.diagnostics?.rollbackVerificationError).toBeInstanceOf(Error);
});

test('all readbacks and rollback execution failing returns separate errors', async () => {
  (TrackPlayer.getQueue as jest.Mock).mockRejectedValue(new Error('readback'));
  (TrackPlayer.reset as jest.Mock).mockRejectedValueOnce(new Error('rollback'));
  const result = await recoverNativeQueueMutation({ originalError: new Error('original'), snapshot: snapshot(), knownSongs: songs, librarySongs: songs, targets: targets() });
  expect(result).toMatchObject({ status: 'failed', originalError: expect.any(Error), initialReadbackError: expect.any(Error), rollbackExecutionError: expect.any(Error), finalReadbackError: expect.any(Error) });
});

test.each([
  ['set false', songs[0], false, 'unconfirmed'],
  ['set reject', songs[0], new Error('set'), 'rejected'],
  ['remove false', null, false, 'unconfirmed'],
  ['remove reject', null, new Error('remove'), 'rejected'],
] as const)('persistence distinguishes %s', async (_label, activeSong, outcome, status) => {
  const method = activeSong ? 'set' : 'remove';
  const spy = jest.spyOn(storage, method as 'set').mockImplementationOnce(() => outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome) as never);
  await expect(persistNativeCurrentSong(activeSong, songs)).resolves.toMatchObject({ status });
  spy.mockRestore();
});
