import TrackPlayer from 'react-native-track-player';
import { getNativeHydrationGate, type NativeHydrationGateSnapshot } from './nativeHydrationGate';
import { assertNativePlaybackNotQuarantined, createNativePlaybackWatchdog } from './nativePlaybackWatchdog';

export type NativeSeek = (seconds: number) => Promise<void>;
export interface NativeSeekIdentity { id: string; uri?: string }
interface NativeSeekOptions {
  requireStableReadyHydration?: boolean;
  songIdentity?: NativeSeekIdentity;
  timeoutMs?: number;
}
export type NativeSeekResult = { status: 'applied' | 'deferred' | 'stale' }
  | { status: 'failed'; error: unknown };
type CapturedHydrationGate = NativeHydrationGateSnapshot | null | undefined;
interface PendingSeek {
  millis: number;
  seek: NativeSeek;
  gate: CapturedHydrationGate;
  revision: number;
  options?: NativeSeekOptions;
  resolve: (result: NativeSeekResult) => void;
}
const defaultNativeSeek: NativeSeek = seconds => TrackPlayer.seekTo(seconds);
const toSafeSeconds = (millis: number): number => Number.isFinite(millis) && millis > 0 ? millis / 1000 : 0;
let pending: PendingSeek | null = null;
let drainPromise: Promise<void> | null = null;
let seekRevision = 0;
let seekBlockCount = 0;

export interface NativeSeekLaneBarrier { waitForDrain: Promise<void>; release: () => void }
const captureHydrationGate = (options?: NativeSeekOptions): CapturedHydrationGate => {
  if (!options?.requireStableReadyHydration) return undefined;
  const gate = getNativeHydrationGate();
  return gate.owned && gate.status === 'ready' ? gate : null;
};
const isGateCurrent = (captured: CapturedHydrationGate): boolean => {
  if (captured === undefined) return true;
  if (captured === null) return false;
  const current = getNativeHydrationGate();
  return current.owned && current.status === 'ready'
    && current.generation === captured.generation && current.revision === captured.revision;
};
const isRequestCurrent = (request: PendingSeek): boolean =>
  request.revision === seekRevision && isGateCurrent(request.gate);
const performSeek = async (request: PendingSeek, assertCurrent: () => void): Promise<NativeSeekResult> => {
  if (!isRequestCurrent(request)) return { status: 'stale' };
  const identity = request.options?.songIdentity;
  if (identity) {
    const active = await TrackPlayer.getActiveTrack();
    assertCurrent();
    if (!isRequestCurrent(request) || active?.id !== identity.id
      || (identity.uri !== undefined && active.url !== identity.uri)) return { status: 'stale' };
  }
  assertCurrent();
  await request.seek(toSafeSeconds(request.millis));
  assertCurrent();
  return { status: 'applied' };
};

const runSeek = async (request: PendingSeek): Promise<void> => {
  try {
    const watchdog = createNativePlaybackWatchdog('seek', request.options?.timeoutMs);
    watchdog.start();
    const flight = performSeek(request, watchdog.assertCurrent);
    void watchdog.observe(flight).then(request.resolve, error => {
      console.warn('[Seek] native seek failed.', error);
      request.resolve({ status: 'failed', error });
    });
    // The barrier waits for the actual native flight, never the timed-out result.
    await flight.catch(() => undefined);
  } catch (error) { request.resolve({ status: 'failed', error }); }
};

const startDrain = (): void => {
  if (drainPromise || seekBlockCount > 0 || !pending) return;
  const run = (async () => {
    while (pending && seekBlockCount === 0) {
      const request = pending;
      pending = null;
      await runSeek(request);
    }
  })();
  drainPromise = run.finally(() => { drainPromise = null; startDrain(); });
};

/** Latest value wins. A blocked seek requires the caller's target identity. */
export const requestLatestSeek = (
  millis: number,
  seek: NativeSeek = defaultNativeSeek,
  options?: NativeSeekOptions,
): Promise<NativeSeekResult> => {
  const gate = captureHydrationGate(options);
  if (gate === null || (seekBlockCount > 0 && !options?.songIdentity)) {
    return Promise.resolve({ status: 'stale' });
  }
  try { assertNativePlaybackNotQuarantined(); }
  catch (error) { return Promise.resolve({ status: 'failed', error }); }
  pending?.resolve({ status: 'stale' });
  const result = new Promise<NativeSeekResult>(resolve => {
    pending = { millis, seek, gate, revision: seekRevision, options, resolve };
    if (seekBlockCount > 0) resolve({ status: 'deferred' });
  });
  startDrain();
  // Each caller settles with its own flight. Only a queue mutation's barrier
  // waits for the lane, which may contain later requests or a hung native call.
  return result;
};

export const blockSeekLaneForNativeMutation = (): NativeSeekLaneBarrier => {
  seekRevision += 1;
  if (seekBlockCount === 0) { pending?.resolve({ status: 'stale' }); pending = null; }
  else if (pending) pending.revision = seekRevision;
  seekBlockCount += 1;
  const waitForDrain = drainPromise ?? Promise.resolve();
  let released = false;
  return { waitForDrain, release: () => {
    if (released) return;
    released = true;
    seekBlockCount = Math.max(0, seekBlockCount - 1);
    startDrain();
  } };
};
export const isSeekDrainingForTests = (): boolean => drainPromise !== null;
export const resetSeekControllerForTests = (): void => {
  pending?.resolve({ status: 'stale' });
  pending = null;
  seekRevision = 0;
  seekBlockCount = 0;
  drainPromise = null;
};
