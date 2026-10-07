import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { addEventListener } from './events';
import { getPlaybackState, getPlayWhenReady, getProgress } from './player';
import { Event, type PlaybackState, type Progress } from './types';

export const usePlaybackState = (): PlaybackState | { state: undefined } => {
  const [state, setState] = useState<PlaybackState | { state: undefined }>({ state: undefined });
  useEffect(() => {
    let active = true;
    let revision = 0;
    const refresh = async () => {
      const requested = ++revision;
      try {
        const value = await getPlaybackState();
        if (active && revision === requested) setState(value);
      } catch { /* Startup errors are displayed by the app's recovery gate. */ }
    };
    const subscription = addEventListener(Event.PlaybackState, value => {
      revision += 1;
      if (active) setState(value);
    });
    const appState = AppState.addEventListener('change', value => { if (value === 'active') void refresh(); });
    void refresh();
    return () => { active = false; subscription.remove(); appState.remove(); };
  }, []);
  return state;
};

export const usePlayWhenReady = (): boolean | undefined => {
  const [value, setValue] = useState<boolean>();
  useEffect(() => {
    let active = true;
    let revision = 0;
    const refresh = async () => {
      const requested = ++revision;
      try {
        const next = await getPlayWhenReady();
        if (active && revision === requested) setValue(next);
      } catch { /* Native startup has not completed. */ }
    };
    const subscription = addEventListener(Event.PlaybackPlayWhenReadyChanged, event => {
      revision += 1;
      if (active) setValue(event.playWhenReady);
    });
    const appState = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    void refresh();
    return () => { active = false; subscription.remove(); appState.remove(); };
  }, []);
  return value;
};

/** V4 callers pass milliseconds; V5's hook takes seconds, so own this poll. */
export const useProgress = (updateInterval = 1000): Progress => {
  const [progress, setProgress] = useState<Progress>({ position: 0, duration: 0, buffered: 0 });
  useEffect(() => {
    let active = true;
    let reading = false;
    const refresh = async () => {
      if (reading || !active) return;
      reading = true;
      try {
        const next = await getProgress();
        if (active) setProgress(next);
      } catch { /* Ignore the initial pre-setup read; recovery is handled above. */ }
      finally { reading = false; }
    };
    const intervalMs = Number.isFinite(updateInterval) && updateInterval > 0 ? updateInterval : 1000;
    const timer = setInterval(() => { void refresh(); }, intervalMs);
    const appState = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    void refresh();
    return () => { active = false; clearInterval(timer); appState.remove(); };
  }, [updateInterval]);
  return progress;
};
