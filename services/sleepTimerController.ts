import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, { State } from 'react-native-track-player';
import { runExclusiveNativePlaybackControl } from '../utils/nativeQueueMutationLock';

type SleepTimerListener = (active: boolean) => void;
type SleepTimerExpiryGuard = () => boolean;

const SLEEP_TIMER_STORAGE_KEY = '@musikplayer:sleepTimerDeadlineMs';

let sleepTimerDeadlineMs: number | null = null;
let sleepTimerGeneration = 0;
let sleepTimerPersistenceQueue: Promise<void> = Promise.resolve();
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

const logSleepTimerError = (error: unknown): void => {
  console.warn('[sleepTimerController] Sleep timer expiry failed', error);
};

const logSleepTimerPersistenceError = (operation: string, error: unknown): void => {
  console.warn(`[sleepTimerController] Sleep timer ${operation} failed`, error);
};

const persistSleepTimerDeadline = (deadlineMs: number | null, generation: number): void => {
  sleepTimerPersistenceQueue = sleepTimerPersistenceQueue
    .catch(() => undefined)
    .then(async () => {
      if (sleepTimerGeneration !== generation) return;
      if (deadlineMs === null) {
        await AsyncStorage.removeItem(SLEEP_TIMER_STORAGE_KEY);
      } else {
        await AsyncStorage.setItem(SLEEP_TIMER_STORAGE_KEY, String(deadlineMs));
      }
    })
    .catch(error => logSleepTimerPersistenceError(deadlineMs === null ? 'clear' : 'save', error));
};

const retrySleepTimerAfterError = (deadlineMs: number): void => {
  if (sleepTimerDeadlineMs !== deadlineMs) return;

  clearSleepTimerTimeout();
  sleepTimerTimeout = setTimeout(() => {
    enforceExpiredSleepTimer().catch(logSleepTimerError);
  }, 1000);
};

const PAUSABLE_ON_EXPIRY_STATES = new Set<State>([State.Playing, State.Loading, State.Buffering]);

export const pausePlaybackExplicitly = async (
  shouldPause: SleepTimerExpiryGuard = () => true,
): Promise<boolean> => {
  return runExclusiveNativePlaybackControl(async () => {
    if (!shouldPause()) return false;
    const state = (await TrackPlayer.getPlaybackState()).state;
    if (!shouldPause()) return false;
    if (!PAUSABLE_ON_EXPIRY_STATES.has(state)) return true;
    await TrackPlayer.pause();
    return shouldPause();
  });
};

export const enforceExpiredSleepTimer = async (nowMs: number = Date.now()): Promise<boolean> => {
  const expiredDeadlineMs = sleepTimerDeadlineMs;
  if (expiredDeadlineMs === null || nowMs < expiredDeadlineMs) return false;

  const isCurrentExpiry = (): boolean => sleepTimerDeadlineMs === expiredDeadlineMs;
  clearSleepTimerTimeout();

  try {
    const completedForCurrentDeadline = await pausePlaybackExplicitly(isCurrentExpiry);
    if (!completedForCurrentDeadline || !isCurrentExpiry()) return false;
  } catch (error) {
    if (isCurrentExpiry()) {
      retrySleepTimerAfterError(expiredDeadlineMs);
      throw error;
    }
    return false;
  }

  sleepTimerDeadlineMs = null;
  sleepTimerGeneration += 1;
  persistSleepTimerDeadline(null, sleepTimerGeneration);
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
  sleepTimerGeneration += 1;
  persistSleepTimerDeadline(sleepTimerDeadlineMs, sleepTimerGeneration);
  scheduleSleepTimerTimeout();
  notifySleepTimerListeners();
};

export const cancelSleepTimer = (): void => {
  clearSleepTimerTimeout();
  const wasActive = sleepTimerDeadlineMs !== null;
  sleepTimerDeadlineMs = null;
  sleepTimerGeneration += 1;
  persistSleepTimerDeadline(null, sleepTimerGeneration);
  if (wasActive) notifySleepTimerListeners();
};

export const restorePersistedSleepTimer = async (nowMs: number = Date.now()): Promise<boolean> => {
  const generationAtStart = sleepTimerGeneration;
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(SLEEP_TIMER_STORAGE_KEY);
  } catch (error) {
    logSleepTimerPersistenceError('restore', error);
    return false;
  }

  if (sleepTimerGeneration !== generationAtStart || raw === null) return false;
  const deadlineMs = Number(raw);
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs <= 0) {
    sleepTimerGeneration += 1;
    persistSleepTimerDeadline(null, sleepTimerGeneration);
    return false;
  }

  sleepTimerDeadlineMs = deadlineMs;
  notifySleepTimerListeners();
  if (deadlineMs <= nowMs) {
    await enforceExpiredSleepTimer(nowMs);
    return false;
  }
  scheduleSleepTimerTimeout();
  return true;
};

export const isSleepTimerActive = (): boolean => sleepTimerDeadlineMs !== null;

export const getSleepTimerDeadlineMs = (): number | null => sleepTimerDeadlineMs;

export const subscribeToSleepTimer = (listener: SleepTimerListener): (() => void) => {
  listeners.add(listener);
  listener(isSleepTimerActive());
  return () => {
    listeners.delete(listener);
  };
};

export const resetSleepTimerForTests = (options: { preservePersisted?: boolean } = {}): void => {
  clearSleepTimerTimeout();
  sleepTimerDeadlineMs = null;
  sleepTimerGeneration += 1;
  sleepTimerPersistenceQueue = Promise.resolve();
  listeners.clear();
  if (!options.preservePersisted) void AsyncStorage.removeItem(SLEEP_TIMER_STORAGE_KEY);
};
