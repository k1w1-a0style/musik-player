import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cancelSleepTimer as cancelSharedSleepTimer,
  isSleepTimerActive,
  startSleepTimer as startSharedSleepTimer,
  subscribeToSleepTimer,
} from '../services/sleepTimerController';

interface SleepTimerState {
  sleepTimerActive: boolean;
  startSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;
}

export const useSleepTimer = (): SleepTimerState => {
  const [sleepTimerActive, setSleepTimerActive] = useState(isSleepTimerActive);

  useEffect(() => subscribeToSleepTimer(setSleepTimerActive), []);
  useEffect(() => cancelSharedSleepTimer, []);

  const startSleepTimer = useCallback((minutes: number) => {
    startSharedSleepTimer(minutes);
  }, []);

  const cancelSleepTimer = useCallback(() => {
    cancelSharedSleepTimer();
  }, []);

  return useMemo(() => ({
    sleepTimerActive,
    startSleepTimer,
    cancelSleepTimer,
  }), [cancelSleepTimer, sleepTimerActive, startSleepTimer]);
};
