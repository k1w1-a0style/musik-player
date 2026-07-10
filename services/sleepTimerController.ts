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

export const pausePlaybackExplicitly = async (): Promise<void> => {
  const state = (await TrackPlayer.getPlaybackState()).state;
  if (state !== State.Playing) return;

  await runExclusiveNativePlaybackControl(() => TrackPlayer.pause());
};

export const enforceExpiredSleepTimer = async (nowMs: number = Date.now()): Promise<boolean> => {
  if (sleepTimerDeadlineMs === null || nowMs < sleepTimerDeadlineMs) return false;

  clearSleepTimerTimeout();
  sleepTimerDeadlineMs = null;
  notifySleepTimerListeners();
  await pausePlaybackExplicitly();
  return true;
};

const scheduleSleepTimerTimeout = (): void => {
  clearSleepTimerTimeout();
  if (sleepTimerDeadlineMs === null) return;

  const delayMs = Math.max(0, sleepTimerDeadlineMs - Date.now());
  sleepTimerTimeout = setTimeout(() => {
    void enforceExpiredSleepTimer();
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
