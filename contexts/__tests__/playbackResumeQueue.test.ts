import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import { runPlaySongQueueAction } from '../playbackQueueActionHelpers';
import { resetNativeQueueMutationLockForTests } from '../../utils/nativeQueueMutationLock';
import { recordNativePlaybackIntent } from '../../utils/nativePlaybackIntent';
import { getResumeSource } from '../../utils/resumePosition';
import type { Song } from '../../types/Song';
const songs: Song[] = [0, 1].map(index => ({ id: `mix-${index}`, title: 'Mix', artist: 'DJ', uri: `file:///mix-${index}.mp3`,
  fileInfo: { size: 10, modificationTime: 1700000000000 }, duration: 3600000 }));
const player = TrackPlayer as typeof TrackPlayer & { __reset: () => void };
const inputs = (queue: Song[]) => ({ songsRef: { current: songs }, queueContextRef: { current: queue },
  baseQueueContextRef: { current: queue }, nativeQueueRef: { current: queue }, setPlaybackQueue: jest.fn(), setCurrentSong: jest.fn() });
beforeEach(async () => {
  resetNativeQueueMutationLockForTests(); player.__reset(); await AsyncStorage.clear(); jest.clearAllMocks();
});
test('a rebuilt queue confirms the stored seek before starting audio', async () => {
  const result = await runPlaySongQueueAction({ ...inputs([]), song: songs[1], startPositionMs: 122000 });
  expect(result.status).toBe('applied'); expect(TrackPlayer.seekTo).toHaveBeenCalledWith(122);
  expect((TrackPlayer.seekTo as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((TrackPlayer.play as jest.Mock).mock.invocationCallOrder[0]);
});
test.each([122000, 0])('queue reuse pauses, selects, seeks to %s and then plays under the same owner', async startPositionMs => {
  await TrackPlayer.add(songs.map(song => ({ ...song, url: song.uri! })));
  await TrackPlayer.play(); jest.clearAllMocks();
  const result = await runPlaySongQueueAction({ ...inputs(songs), song: songs[1], startPositionMs });
  expect(result.status).toBe('applied'); expect(TrackPlayer.reset).not.toHaveBeenCalled();
  const order = [TrackPlayer.pause, TrackPlayer.skip, TrackPlayer.seekTo, TrackPlayer.play].map(fn => (fn as jest.Mock).mock.invocationCallOrder[0]);
  expect(order).toEqual([...order].sort((a, b) => a - b)); expect(TrackPlayer.seekTo).toHaveBeenCalledWith(startPositionMs / 1000);
});
test('a newer pause during a delayed seek remains paused after resume preparation', async () => {
  let finish!: () => void;
  (TrackPlayer.seekTo as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const pending = runPlaySongQueueAction({ ...inputs([]), song: songs[1], startPositionMs: 122000 });
  await new Promise(resolve => setImmediate(resolve));
  recordNativePlaybackIntent('paused'); finish(); await pending;
  expect(TrackPlayer.play).not.toHaveBeenCalled(); expect(TrackPlayer.pause).toHaveBeenCalled();
});
test('a changed source does not receive an older position and causes no native mutation', async () => {
  const source = getResumeSource(songs[1])!;
  const changed = { ...songs[1], fileInfo: { ...songs[1].fileInfo, size: 11 } };
  const input = inputs([songs[0], changed]); input.songsRef.current = [songs[0], changed];
  const result = await runPlaySongQueueAction({ ...input, song: changed, startPositionMs: 122000, resumeSource: source });
  expect(result.status).toBe('stale'); expect(TrackPlayer.reset).not.toHaveBeenCalled(); expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
});
test('a native queue with the same ID but an older source is rebuilt before seeking', async () => {
  const old = { ...songs[1], fileInfo: { ...songs[1].fileInfo, size: 9 } };
  await TrackPlayer.add([songs[0], old].map(song => ({ ...song, url: song.uri! }))); jest.clearAllMocks();
  const input = inputs(songs); input.nativeQueueRef.current = [songs[0], old];
  const result = await runPlaySongQueueAction({ ...input, song: songs[1], startPositionMs: 122000 });
  expect(result.status).toBe('applied'); expect(TrackPlayer.reset).toHaveBeenCalled();
});
