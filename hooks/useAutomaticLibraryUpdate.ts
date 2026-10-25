import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useLibraryUpdatePreferences } from '../contexts/LibraryUpdateContext';
import { getLibraryScanOperation } from '../utils/libraryScanOperation';
import type { LibraryScanRequest } from '../utils/libraryScanSources';

const MIN_UPDATE_INTERVAL_MS = 30_000;
/** Foreground events only. No polling, OS background-service claim or permission prompts. */
export const useAutomaticLibraryUpdate = ({ ready, busy, hasFolders, update }: {
  ready: boolean; busy: boolean; hasFolders: boolean;
  update: (options?: LibraryScanRequest) => Promise<void>;
}): void => {
  const { preferences, isHydrated } = useLibraryUpdatePreferences();
  const latest = useRef({ busy, hasFolders, update });
  latest.current = { busy, hasFolders, update };
  const lastStarted = useRef(-Infinity);
  const startupHandled = useRef(false);
  const pending = useRef(false);
  const inFlight = useRef(false);
  useEffect(() => {
    if (!ready || !isHydrated) return;
    if (!preferences.onOpen && !preferences.whileOpen) pending.current = false;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let mediaSubscription: ReturnType<typeof MediaLibrary.addListener> | undefined;
    let appState = AppState.currentState;
    const run = async () => {
      timer = undefined;
      if (!alive || AppState.currentState !== 'active' || latest.current.busy || inFlight.current
        || getLibraryScanOperation().status === 'running') return;
      inFlight.current = true;
      let started = false;
      try {
        const source = latest.current.hasFolders ? 'folders' : 'media-library';
        if (source === 'media-library' && (await MediaLibrary.getPermissionsAsync(false, ['audio'])).status !== 'granted') return;
        if (!alive || latest.current.busy || AppState.currentState !== 'active') return;
        pending.current = false;
        started = true;
        lastStarted.current = Date.now();
        await latest.current.update({ source, automatic: true });
      } finally {
        inFlight.current = false;
        if (alive && started && pending.current) schedule();
      }
    };
    const schedule = () => {
      pending.current = true;
      if (timer) return;
      const wait = Math.max(1000, MIN_UPDATE_INTERVAL_MS - (Date.now() - lastStarted.current));
      timer = setTimeout(() => { void run().catch(() => undefined); }, wait);
    };
    if (!startupHandled.current) {
      startupHandled.current = true;
      if (preferences.onOpen) schedule();
    }
    if (pending.current && !busy) schedule();
    const appSubscription = AppState.addEventListener('change', next => {
      const resumed = next === 'active' && appState !== 'active';
      appState = next;
      if (resumed && preferences.whileOpen) schedule();
    });
    if (preferences.whileOpen) {
      void MediaLibrary.getPermissionsAsync(false, ['audio']).then(permission => {
        if (alive && permission.status === 'granted') mediaSubscription = MediaLibrary.addListener(schedule);
      }).catch(() => undefined);
    }
    return () => { alive = false; if (timer) clearTimeout(timer); appSubscription.remove(); mediaSubscription?.remove(); };
  }, [ready, busy, isHydrated, preferences.onOpen, preferences.whileOpen]);
};
