import { guardNativePlaybackActions, type NativePlaybackActions } from '../nativePlaybackActionGuard';

const createActions = () => {
  const native = jest.fn(async () => undefined);
  const queue = jest.fn(async () => ({ status: 'applied' as const }));
  const actions: NativePlaybackActions = {
    playSong: queue, playSongNext: queue, addSongToQueue: queue, reorderQueue: queue,
    toggleShuffle: queue, playPlaylist: native, next: native, previous: native,
    togglePlayPause: native, seekTo: native, stop: native,
  };
  return { actions, native, queue };
};

test('degraded hydration centrally blocks and settles every native playback action', async () => {
  const { actions, native, queue } = createActions();
  const guarded = guardNativePlaybackActions('degraded', actions);
  await expect(guarded.playSong({ id: 's1', title: 'One', artist: 'A' })).resolves.toMatchObject({ status: 'failed' });
  await expect(guarded.playSongNext({ id: 's1', title: 'One', artist: 'A' })).resolves.toMatchObject({ status: 'failed' });
  await expect(guarded.addSongToQueue({ id: 's1', title: 'One', artist: 'A' })).resolves.toMatchObject({ status: 'failed' });
  await expect(guarded.reorderQueue(0, 1)).resolves.toMatchObject({ status: 'failed' });
  await expect(guarded.toggleShuffle()).resolves.toMatchObject({ status: 'failed' });
  await expect(Promise.all([
    guarded.playPlaylist('p1'), guarded.next(), guarded.previous(), guarded.togglePlayPause(),
    guarded.seekTo(1000), guarded.stop(),
  ])).resolves.toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
  expect(native).not.toHaveBeenCalled();
  expect(queue).not.toHaveBeenCalled();
});

test('ready hydration preserves the native action implementation', () => {
  const { actions } = createActions();
  expect(guardNativePlaybackActions('ready', actions)).toBe(actions);
});
