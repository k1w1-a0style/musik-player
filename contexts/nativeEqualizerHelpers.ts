import SystemAudio, { type EqInitResult } from 'expo-system-audio';
import { NativeModules } from 'react-native';
import {
  buildNativeEqBandUpdates,
  canUseNativeEq,
  shouldApplyNativeEqBands,
} from '../utils/audioEffects';

interface TrackPlayerNativeAudioSessionModule {
  getAudioSessionId?: () => Promise<number | null>;
}

const EQ_SESSION_ATTEMPTS = 12;
const EQ_SESSION_RETRY_MS = 250;
let equalizerInitQueue: Promise<void> = Promise.resolve();
const ABORTED = Symbol('native-equalizer-aborted');

const waitForValueOrAbort = <T>(operation: Promise<T>, signal?: AbortSignal): Promise<T | typeof ABORTED> => {
  if (!signal) return operation;
  if (signal.aborted) return Promise.resolve(ABORTED);
  return new Promise(resolve => {
    const handleAbort = () => {
      signal.removeEventListener('abort', handleAbort);
      resolve(ABORTED);
    };
    signal.addEventListener('abort', handleAbort, { once: true });
    void operation.then(
      value => {
        signal.removeEventListener('abort', handleAbort);
        resolve(value);
      },
      () => {
        signal.removeEventListener('abort', handleAbort);
        resolve(null as T);
      },
    );
  });
};

const waitForRetry = (signal?: AbortSignal): Promise<void> => new Promise(resolve => {
  if (signal?.aborted) {
    resolve();
    return;
  }
  const finish = () => {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', finish);
    resolve();
  };
  const timeout = setTimeout(finish, EQ_SESSION_RETRY_MS);
  signal?.addEventListener('abort', finish, { once: true });
});

export const getTrackPlayerAudioSessionId = async (): Promise<number | null> => {
  const trackPlayer = NativeModules.TrackPlayerModule as TrackPlayerNativeAudioSessionModule | undefined;
  if (typeof trackPlayer?.getAudioSessionId !== 'function') return null;
  try {
    const sessionId = await trackPlayer.getAudioSessionId();
    return Number.isInteger(sessionId) && Number(sessionId) > 0 ? Number(sessionId) : null;
  } catch {
    return null;
  }
};

const performNativeEqualizerInit = async (signal?: AbortSignal): Promise<EqInitResult | null> => {
  for (let attempt = 0; attempt < EQ_SESSION_ATTEMPTS && !signal?.aborted; attempt += 1) {
    const audioSessionId = await waitForValueOrAbort(getTrackPlayerAudioSessionId(), signal);
    if (audioSessionId === ABORTED) return null;
    if (signal?.aborted) return null;
    if (audioSessionId !== null) {
      try {
        return await SystemAudio.eqInit(audioSessionId);
      } catch {
        return null;
      }
    }
    if (attempt + 1 < EQ_SESSION_ATTEMPTS) await waitForRetry(signal);
  }
  return null;
};

export const initNativeEqualizer = (signal?: AbortSignal): Promise<EqInitResult | null> => {
  // The native Equalizer is a singleton. Serializing initialization prevents a
  // stale, slow session lookup from replacing a newer TrackPlayer session after
  // React effect cleanup/replay or a track-session change.
  const operation = equalizerInitQueue
    .catch(() => undefined)
    .then(() => performNativeEqualizerInit(signal));
  equalizerInitQueue = operation.then(() => undefined, () => undefined);
  return operation;
};

export const releaseNativeEqualizer = (): void => {
  SystemAudio.eqRelease();
};

export const applyNativeEqualizerEnabled = (
  eqNative: EqInitResult | null,
  eqEnabled: boolean,
): void => {
  if (!canUseNativeEq(eqNative)) return;
  SystemAudio.eqSetEnabled(eqEnabled);
};

export const applyNativeEqualizerBands = (
  eqNative: EqInitResult | null,
  eqEnabled: boolean,
  eqBands: number[],
): void => {
  if (!shouldApplyNativeEqBands(eqNative, eqEnabled)) return;
  buildNativeEqBandUpdates(eqNative, eqBands).forEach(update => {
    SystemAudio.eqSetBandLevel(update.index, update.millibel);
  });
};
