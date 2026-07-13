import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cancelSleepTimer as cancelSharedSleepTimer,
  getSleepTimerDeadlineMs,
  isSleepTimerActive,
  startSleepTimer as startSharedSleepTimer,
  subscribeToSleepTimer,
} from '../services/sleepTimerController';

interface SleepTimerState {
  sleepTimerActive: boolean;
  sleepTimerRemainingSeconds: number | null;
  sleepTimerDeadlineMs: number | null;
  startSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;
}

export const getSleepTimerRemainingSeconds = (deadlineMs: number | null, nowMs: number = Date.now()): number | null => {
  if (deadlineMs === null) return null;
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
};

export const formatSleepTimerRemaining = (remainingSeconds: number | null): string | null => {
  if (remainingSeconds === null) return null;

  const totalSeconds = Math.max(0, remainingSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');

  return hours > 0 ? `${hours}:${paddedMinutes}:${paddedSeconds}` : `${paddedMinutes}:${paddedSeconds}`;
};

export const useSleepTimer = (): SleepTimerState => {
  const [sleepTimerActive, setSleepTimerActive] = useState(isSleepTimerActive);
  const [sleepTimerDeadlineMs, setSleepTimerDeadlineMs] = useState(getSleepTimerDeadlineMs);
  const [sleepTimerRemainingSeconds, setSleepTimerRemainingSeconds] = useState(() => (
    getSleepTimerRemainingSeconds(getSleepTimerDeadlineMs())
  ));

  const refreshSleepTimerState = useCallback((active: boolean = isSleepTimerActive()) => {
    const deadlineMs = active ? getSleepTimerDeadlineMs() : null;
    setSleepTimerActive(active);
    setSleepTimerDeadlineMs(deadlineMs);
    setSleepTimerRemainingSeconds(getSleepTimerRemainingSeconds(deadlineMs));
  }, []);

  useEffect(() => subscribeToSleepTimer(refreshSleepTimerState), [refreshSleepTimerState]);

  useEffect(() => {
    if (!sleepTimerActive) return undefined;

    const interval = setInterval(() => {
      refreshSleepTimerState();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [refreshSleepTimerState, sleepTimerActive]);

  const startSleepTimer = useCallback((minutes: number) => {
    startSharedSleepTimer(minutes);
  }, []);

  const cancelSleepTimer = useCallback(() => {
    cancelSharedSleepTimer();
  }, []);

  return useMemo(() => ({
    sleepTimerActive,
    sleepTimerRemainingSeconds,
    sleepTimerDeadlineMs,
    startSleepTimer,
    cancelSleepTimer,
  }), [cancelSleepTimer, sleepTimerActive, sleepTimerDeadlineMs, sleepTimerRemainingSeconds, startSleepTimer]);
};
