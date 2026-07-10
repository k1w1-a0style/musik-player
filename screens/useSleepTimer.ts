import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSleepTimerOptions {
  isPlaying: boolean;
  pausePlayback: () => Promise<void> | void;
}

interface SleepTimerState {
  sleepTimerActive: boolean;
  startSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;
}

export const useSleepTimer = ({ isPlaying, pausePlayback }: UseSleepTimerOptions): SleepTimerState => {
  const [sleepTimerActive, setSleepTimerActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const pausePlaybackRef = useRef(pausePlayback);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    pausePlaybackRef.current = pausePlayback;
  }, [pausePlayback]);

  const clearSleepTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const cancelSleepTimer = useCallback(() => {
    clearSleepTimer();
    setSleepTimerActive(false);
  }, [clearSleepTimer]);

  const startSleepTimer = useCallback((minutes: number) => {
    clearSleepTimer();
    setSleepTimerActive(true);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setSleepTimerActive(false);
      if (isPlayingRef.current) {
        void pausePlaybackRef.current();
      }
    }, minutes * 60 * 1000);
  }, [clearSleepTimer]);

  useEffect(() => cancelSleepTimer, [cancelSleepTimer]);

  return { sleepTimerActive, startSleepTimer, cancelSleepTimer };
};
