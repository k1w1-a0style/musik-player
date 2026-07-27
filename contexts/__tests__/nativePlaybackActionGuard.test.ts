import {
  guardNativePlaybackActions,
  NativePlaybackBlockedError,
  type HydrationStatus,
  type NativePlaybackActions,
} from '../nativePlaybackActionGuard';
import {
  acquireNativeHydrationGate,
  publishNativeHydrationGate,
  resetNativeHydrationGateForTests,
} from '../../utils/nativeHydrationGate';

const createActions = () => {
  const native = jest.fn(async () => undefined);
  const queue = jest.fn(async () => ({ status: 'applied' as const }));
  const actions: NativePlaybackActions = {
    playSong: queue,
    playSongNext: queue,
    addSongToQueue: queue,
    reorderQueue: queue,
    toggleShuffle: queue,
    playPlaylist: native,
    next: native,
    previous: native,
    togglePlayPause: native,
    seekTo: native,
    stop: native,
  };
  return { actions, native, queue };
};

const blockedStatuses: Exclude<HydrationStatus, 'ready'>[] = ['loading', 'degraded', 'retry-required'];

beforeEach(resetNativeHydrationGateForTests);

test.each(blockedStatuses)('%s hydration centrally blocks every native playback action', async status => {
  const owner = acquireNativeHydrationGate();
  publishNativeHydrationGate(owner, status);
  const { actions, native, queue } = createActions();
  const guarded = guardNativePlaybackActions(status, actions);

  await expect(guarded.playSong({ id: 's1', title: 'One', artist: 'A' })).resolves.toMatchObject({
    status: 'failed',
    error: expect.objectContaining({ name: 'NativePlaybackBlockedError', hydrationStatus: status }),
  });
  await expect(guarded.playSongNext({ id: 's1', title: 'One', artist: 'A' })).resolves.toMatchObject({ status: 'failed' });
  await expect(guarded.addSongToQueue({ id: 's1', title: 'One', artist: 'A' })).resolves.toMatchObject({ status: 'failed' });
  await expect(guarded.reorderQueue(0, 1)).resolves.toMatchObject({ status: 'failed' });
  await expect(guarded.toggleShuffle()).resolves.toMatchObject({ status: 'failed' });

  for (const action of [
    () => guarded.playPlaylist('p1'),
    () => guarded.next(),
    () => guarded.previous(),
    () => guarded.togglePlayPause(),
    () => guarded.seekTo(1000),
    () => guarded.stop(),
  ]) {
    await expect(action()).rejects.toEqual(expect.any(NativePlaybackBlockedError));
  }

  expect(native).not.toHaveBeenCalled();
  expect(queue).not.toHaveBeenCalled();
});

test('ready hydration executes the native action implementation', async () => {
  const owner = acquireNativeHydrationGate();
  publishNativeHydrationGate(owner, 'ready');
  const { actions, native, queue } = createActions();
  const guarded = guardNativePlaybackActions('ready', actions);

  await expect(guarded.next()).resolves.toBeUndefined();
  await expect(guarded.toggleShuffle()).resolves.toMatchObject({ status: 'applied' });
  expect(native).toHaveBeenCalledTimes(1);
  expect(queue).toHaveBeenCalledTimes(1);
});

test('an already captured ready action is blocked after the central gate degrades', async () => {
  const owner = acquireNativeHydrationGate();
  publishNativeHydrationGate(owner, 'ready');
  const { actions, native } = createActions();
  const guarded = guardNativePlaybackActions('ready', actions);

  publishNativeHydrationGate(owner, 'degraded');

  await expect(guarded.next()).rejects.toMatchObject({
    name: 'NativePlaybackBlockedError',
    hydrationStatus: 'degraded',
  });
  expect(native).not.toHaveBeenCalled();
});

test('a captured blocked action executes after the central gate becomes ready', async () => {
  const owner = acquireNativeHydrationGate();
  publishNativeHydrationGate(owner, 'degraded');
  const { actions, native } = createActions();
  const guarded = guardNativePlaybackActions('degraded', actions);

  publishNativeHydrationGate(owner, 'ready');

  await expect(guarded.next()).resolves.toBeUndefined();
  expect(native).toHaveBeenCalledTimes(1);
});

test('undefined legacy status preserves the native action implementation', () => {
  const { actions } = createActions();
  expect(guardNativePlaybackActions(undefined, actions)).toBe(actions);
});
