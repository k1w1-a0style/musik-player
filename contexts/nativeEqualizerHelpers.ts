import SystemAudio, { type EqInitResult } from 'expo-system-audio';
import TrackPlayer from 'react-native-track-player';
import {
  buildNativeEqBandUpdates,
  canUseNativeEq,
  shouldApplyNativeEqBands,
} from '../utils/audioEffects';

const EQ_SESSION_ATTEMPTS = 12;
const EQ_SESSION_RETRY_MS = 250;
const EQ_BAND_WRITE_INTERVAL_MS = 16;
let equalizerInitQueue: Promise<void> = Promise.resolve();

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
  try {
    const sessionId = await TrackPlayer.getAudioSessionId();
    return Number.isInteger(sessionId) && Number(sessionId) > 0 ? Number(sessionId) : null;
  } catch {
    return null;
  }
};

const performNativeEqualizerInit = async (signal?: AbortSignal): Promise<EqInitResult | null> => {
  for (let attempt = 0; attempt < EQ_SESSION_ATTEMPTS && !signal?.aborted; attempt += 1) {
    const audioSessionId = await getTrackPlayerAudioSessionId();
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
  applyBandUpdates(eqNative, eqBands);
};

const applyBandUpdates = (
  eqNative: EqInitResult,
  eqBands: number[],
  appliedLevels?: Map<number, number>,
): void => {
  buildNativeEqBandUpdates(eqNative, eqBands).forEach(update => {
    if (appliedLevels?.get(update.index) === update.millibel) return;
    if (SystemAudio.eqSetBandLevel(update.index, update.millibel)) {
      appliedLevels?.set(update.index, update.millibel);
    }
  });
};

/** Coalesces slider bursts once per frame; only confirmed changed native bands are written. */
export const createNativeEqualizerBandScheduler = (
  isCurrent: (info: EqInitResult) => boolean,
): {
  schedule: (info: EqInitResult | null, enabled: boolean, bands: number[]) => void;
  cancel: () => void;
} => {
  let pending: { info: EqInitResult; bands: number[] } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let appliedInfo: EqInitResult | null = null;
  const appliedLevels = new Map<number, number>();

  const cancel = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pending = null;
    appliedInfo = null;
    appliedLevels.clear();
  };
  const flush = (): void => {
    timer = undefined;
    const next = pending;
    pending = null;
    if (!next || !isCurrent(next.info)) return;
    if (appliedInfo !== next.info) {
      appliedInfo = next.info;
      appliedLevels.clear();
    }
    applyBandUpdates(next.info, next.bands, appliedLevels);
  };
  const schedule = (info: EqInitResult | null, enabled: boolean, bands: number[]): void => {
    if (!shouldApplyNativeEqBands(info, enabled)) {
      cancel();
      return;
    }
    pending = { info, bands: [...bands] };
    // Keep the first frame deadline while replacing the pending values. A
    // trailing debounce could postpone all writes during a continuous drag.
    if (timer === undefined) timer = setTimeout(flush, EQ_BAND_WRITE_INTERVAL_MS);
  };
  return { schedule, cancel };
};
