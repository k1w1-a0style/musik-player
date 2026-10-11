import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { addEventListener } from './events';
import { getPlaybackState, getPlayWhenReady } from './player';
import { Event, State, type PlaybackState, type Progress } from './types';
import { observeProgress } from './progressObserver';

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

const useForeground = (): boolean => {
  const [foreground, setForeground] = useState(() => AppState.currentState == null
    || AppState.currentState === 'active' || AppState.currentState === 'unknown');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', value => { setForeground(value === 'active'); });
    return () => subscription.remove();
  }, []);
  return foreground;
};

/** Milliseconds, as in V4. Periodic reads belong only to a visible, playing UI. */
export const useProgress = (updateInterval = 1000, options: { enabled?: boolean } = {}): Progress => {
  const [progress, setProgress] = useState<Progress>({ position: 0, duration: 0, buffered: 0 });
  const { state } = usePlaybackState();
  const foreground = useForeground(); const enabled = options.enabled !== false;
  useEffect(() => {
    if (!enabled || !foreground || state === undefined) return undefined;
    const intervalMs = Number.isFinite(updateInterval) && updateInterval > 0 ? updateInterval : 1000;
    return observeProgress(next => setProgress(previous => previous.position === next.position
      && previous.duration === next.duration && previous.buffered === next.buffered ? previous : next), intervalMs, state === State.Playing);
  }, [enabled, foreground, state, updateInterval]);
  return progress;
};
