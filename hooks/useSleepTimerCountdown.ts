import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getSleepTimerRemainingSeconds } from '../screens/useSleepTimer';

/** The visible label owns its clock. Native expiry remains in the shared controller. */
export const useSleepTimerCountdown = (deadlineMs: number | null, visible = true): number | null => {
  const [now, setNow] = useState(Date.now);
  const [foreground, setForeground] = useState(() => AppState.currentState == null
    || AppState.currentState === 'active' || AppState.currentState === 'unknown');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { setForeground(state === 'active'); });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    setNow(Date.now());
    if (deadlineMs === null || !visible || !foreground) return undefined;
    const timer = setInterval(() => { setNow(Date.now()); }, 1000);
    return () => clearInterval(timer);
  }, [deadlineMs, foreground, visible]);
  return getSleepTimerRemainingSeconds(deadlineMs, now);
};
