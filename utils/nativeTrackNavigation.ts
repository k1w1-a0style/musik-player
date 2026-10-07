import TrackPlayer, { RepeatMode } from 'react-native-track-player';
import { getNativeHydrationGate } from './nativeHydrationGate';
import { runExclusiveNativePlaybackControl, type NativePlaybackControlContext } from './nativeQueueMutationLock';
import { enqueuePlaybackIntent, getPlaybackIntentBoundary } from './playbackIntentScheduler';
import { beginPlaybackSelection, finishPlaybackSelection } from './playbackSelectionStatus';

interface NavigationIntent { direction: 1 | -1; restartAfterThreshold: boolean }
interface NavigationBatch { boundary: number; intents: NavigationIntent[]; promise: Promise<void>; closed: boolean }
let batch: NavigationBatch | null = null;

const navigateWithoutQueue = async (intent: NavigationIntent, assertCurrent: () => void): Promise<void> => {
  if (intent.direction > 0) { await TrackPlayer.skipToNext(); return; }
  if (intent.restartAfterThreshold) {
    const { position } = await TrackPlayer.getProgress();
    assertCurrent();
    if (position > 3) { await TrackPlayer.seekTo(0); return; }
  }
  try { await TrackPlayer.skipToPrevious(); }
  catch (error) {
    if (!intent.restartAfterThreshold) throw error;
    assertCurrent();
    await TrackPlayer.seekTo(0);
  }
};

const resolveNavigationTarget = (
  intents: NavigationIntent[], index: number, length: number, repeatAll: boolean, position: number,
) => {
  let target = index;
  let restart = false;
  for (const intent of intents) {
    if (intent.direction < 0 && intent.restartAfterThreshold && position > 3) restart = true;
    else if (intent.direction > 0) {
      target = target + 1 < length ? target + 1 : repeatAll ? 0 : target;
      restart = false;
    } else { target = Math.max(0, target - 1); restart = target === index; }
    position = 0;
  }
  return { target, restart };
};

const readNavigationSnapshot = async (assertCurrent: () => void) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const [queue, index, repeatMode] = await Promise.all([
      TrackPlayer.getQueue(), TrackPlayer.getActiveTrackIndex(), TrackPlayer.getRepeatMode(),
    ]);
    assertCurrent();
    if (queue.length === 0 || index === undefined) return { queue, index, repeatMode };
    const active = await TrackPlayer.getActiveTrack();
    assertCurrent();
    if (queue[index]?.id === active?.id) return { queue, index, repeatMode };
  }
  throw new Error('Native track remained unstable while resolving navigation target.');
};

const drainNavigation = async (pending: NavigationBatch, { assertHydrationCurrent }: NativePlaybackControlContext): Promise<void> => {
  while (pending.intents.length > 0) {
    const intents = pending.intents.splice(0);
    const { queue, index, repeatMode } = await readNavigationSnapshot(assertHydrationCurrent);
    if (queue.length === 0 || index === undefined) {
      for (const intent of intents) { assertHydrationCurrent(); await navigateWithoutQueue(intent, assertHydrationCurrent); }
      continue;
    }
    const position = intents.some(intent => intent.restartAfterThreshold)
      ? (await TrackPlayer.getProgress()).position : 0;
    assertHydrationCurrent();
    const target = resolveNavigationTarget(intents, index, queue.length, repeatMode === RepeatMode.Queue, position);
    if (target.target !== index) {
      const selectionRevision = beginPlaybackSelection({ id: String(queue[target.target].id), title: queue[target.target].title });
      try { await TrackPlayer.skip(target.target); }
      finally { finishPlaybackSelection(selectionRevision); }
    }
    else if (target.restart || intents.length > 1) await TrackPlayer.seekTo(0);
    assertHydrationCurrent();
  }
};

/** Accumulate deliberate taps into a target, bounded by ordered edit/control barriers. */
export const requestNativeTrackNavigation = (direction: 1 | -1, restartAfterThreshold = false): Promise<void> => {
  const boundary = getPlaybackIntentBoundary();
  const intent = { direction, restartAfterThreshold };
  if (batch && !batch.closed && batch.boundary === boundary) {
    batch.intents.push(intent);
    return batch.promise;
  }
  const gate = getNativeHydrationGate();
  const pending: NavigationBatch = { boundary, intents: [intent], promise: Promise.resolve(), closed: false };
  pending.promise = enqueuePlaybackIntent(() => runExclusiveNativePlaybackControl(
    context => drainNavigation(pending, context),
    { hydrationCapture: gate.owned ? gate.status === 'ready' ? gate : null : undefined, invalidatesPendingSeek: true },
  ), 'navigation').finally(() => { pending.closed = true; if (batch === pending) batch = null; });
  batch = pending;
  return pending.promise;
};

export const resetNativeTrackNavigationForTests = (): void => { batch = null; };
