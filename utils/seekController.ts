import TrackPlayer from 'react-native-track-player';
import { getNativeHydrationGate, type NativeHydrationGateSnapshot } from './nativeHydrationGate';

/**
 * Dedicated seek lane for scrubbing.
 *
 * Seeking must feel immediate and must not queue up behind native queue
 * rebuilds or metadata jobs. This controller runs seeks on its own lane and
 * coalesces rapid drag updates so only the latest requested target is sent to
 * the native player (last value wins).
 */
export type NativeSeek = (seconds: number) => Promise<void>;
interface NativeSeekOptions { requireStableReadyHydration?: boolean }
type CapturedHydrationGate = NativeHydrationGateSnapshot | null | undefined;

const toSafeSeconds = (millis: number): number =>
  Number.isFinite(millis) && millis > 0 ? millis / 1000 : 0;

const defaultNativeSeek: NativeSeek = (seconds) => TrackPlayer.seekTo(seconds);

let pendingTargetMillis: number | null = null;
let draining = false;
let drainPromise: Promise<void> | null = null;
let pendingHydrationGate: CapturedHydrationGate;

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

export const requestLatestSeek = async (
  millis: number,
  seek: NativeSeek = defaultNativeSeek,
  options?: NativeSeekOptions,
): Promise<void> => {
  const hydrationGate = captureHydrationGate(options);
  if (hydrationGate === null) return;
  pendingTargetMillis = millis;
  pendingHydrationGate = hydrationGate;
  if (drainPromise) return drainPromise;

  draining = true;
  drainPromise = (async () => {
    try {
      while (pendingTargetMillis !== null) {
        const target = pendingTargetMillis;
        const targetGate = pendingHydrationGate;
        pendingTargetMillis = null;
        pendingHydrationGate = undefined;
        if (!isGateCurrent(targetGate)) continue;
        try {
          await seek(toSafeSeconds(target));
        } catch (error) {
          console.warn('[Seek] native seek failed.', error);
        }
      }
    } finally {
      draining = false;
      drainPromise = null;
    }
  })();

  return drainPromise;
};

export const isSeekDraining = (): boolean => draining;

export const resetSeekControllerForTests = (): void => {
  pendingTargetMillis = null;
  pendingHydrationGate = undefined;
  draining = false;
  drainPromise = null;
};
