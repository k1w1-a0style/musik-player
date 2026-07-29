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

const toSafeSeconds = (millis: number): number =>
  Number.isFinite(millis) && millis > 0 ? millis / 1000 : 0;

const defaultNativeSeek: NativeSeek = (seconds) => TrackPlayer.seekTo(seconds);

let pendingTargetMillis: number | null = null;
let draining = false;
let drainPromise: Promise<void> | null = null;
let pendingHydrationGate: NativeHydrationGateSnapshot | null = null;

const isGateCurrent = (captured: NativeHydrationGateSnapshot | null): boolean => {
  if (!captured) return true;
  const current = getNativeHydrationGate();
  return current.owned && current.status === 'ready'
    && current.generation === captured.generation && current.revision === captured.revision;
};

export const requestLatestSeek = async (
  millis: number,
  seek: NativeSeek = defaultNativeSeek,
): Promise<void> => {
  pendingTargetMillis = millis;
  const gate = getNativeHydrationGate();
  pendingHydrationGate = gate.owned && gate.status === 'ready' ? gate : null;
  if (drainPromise) return drainPromise;

  draining = true;
  drainPromise = (async () => {
    try {
      while (pendingTargetMillis !== null) {
        const target = pendingTargetMillis;
        const targetGate = pendingHydrationGate;
        pendingTargetMillis = null;
        pendingHydrationGate = null;
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
  pendingHydrationGate = null;
  draining = false;
  drainPromise = null;
};
