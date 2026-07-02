import TrackPlayer from 'react-native-track-player';

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

export const requestLatestSeek = async (
  millis: number,
  seek: NativeSeek = defaultNativeSeek,
): Promise<void> => {
  pendingTargetMillis = millis;
  if (drainPromise) return drainPromise;

  draining = true;
  drainPromise = (async () => {
    try {
      while (pendingTargetMillis !== null) {
        const target = pendingTargetMillis;
        pendingTargetMillis = null;
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
  draining = false;
  drainPromise = null;
};
