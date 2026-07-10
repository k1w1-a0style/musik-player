import TrackPlayer, { State } from 'react-native-track-player';
import { runExclusiveNativePlaybackControl } from '../utils/nativeQueueMutationLock';

type SleepTimerListener = (active: boolean) => void;

let sleepTimerDeadlineMs: number | null = null;
let sleepTimerTimeout: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<SleepTimerListener>();

const notifySleepTimerListeners = (): void => {
  const active = sleepTimerDeadlineMs !== null;
  listeners.forEach(listener => listener(active));
};

const clearSleepTimerTimeout = (): void => {
  if (sleepTimerTimeout) {
    clearTimeout(sleepTimerTimeout);
    sleepTimerTimeout = null;
  }
};

const retrySleepTimerAfterError = (): void => {
  if (sleepTimerDeadlineMs === null) return;

  clearSleepTimerTimeout();
  sleepTimerTimeout = setTimeout(() => {
    enforceExpiredSleepTimer().catch(logSleepTimerError);
  }, 1000);
};

const logSleepTimerError = (error: unknown): void => {
  console.warn('[sleepTimerController] Sleep timer expiry failed', error);
};

const PAUSABLE_ON_EXPIRY_STATES = new Set<State>([State.Playing, State.Loading, State.Buffering]);

export const pausePlaybackExplicitly = async (): Promise<void> => {
  const state = (await TrackPlayer.getPlaybackState()).state;
  if (!PAUSABLE_ON_EXPIRY_STATES.has(state)) return;

  await runExclusiveNativePlaybackControl(() => TrackPlayer.pause());
};

export const enforceExpiredSleepTimer = async (nowMs: number = Date.now()): Promise<boolean> => {
  if (sleepTimerDeadlineMs === null || nowMs < sleepTimerDeadlineMs) return false;

  clearSleepTimerTimeout();
  try {
    await pausePlaybackExplicitly();
  } catch (error) {
    retrySleepTimerAfterError();
    throw error;
  }

  sleepTimerDeadlineMs = null;
  notifySleepTimerListeners();
  return true;
};

const scheduleSleepTimerTimeout = (): void => {
  clearSleepTimerTimeout();
  if (sleepTimerDeadlineMs === null) return;

  const delayMs = Math.max(0, sleepTimerDeadlineMs - Date.now());
  sleepTimerTimeout = setTimeout(() => {
    enforceExpiredSleepTimer().catch(logSleepTimerError);
  }, delayMs);
};

export const startSleepTimer = (minutes: number): void => {
  const durationMs = minutes * 60 * 1000;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return;

  sleepTimerDeadlineMs = Date.now() + durationMs;
  scheduleSleepTimerTimeout();
  notifySleepTimerListeners();
};

export const cancelSleepTimer = (): void => {
  clearSleepTimerTimeout();
  if (sleepTimerDeadlineMs === null) return;

  sleepTimerDeadlineMs = null;
  notifySleepTimerListeners();
};

export const isSleepTimerActive = (): boolean => sleepTimerDeadlineMs !== null;

export const subscribeToSleepTimer = (listener: SleepTimerListener): (() => void) => {
  listeners.add(listener);
  listener(isSleepTimerActive());
  return () => {
    listeners.delete(listener);
  };
};

export const resetSleepTimerForTests = (): void => {
  clearSleepTimerTimeout();
  sleepTimerDeadlineMs = null;
  listeners.clear();
};
