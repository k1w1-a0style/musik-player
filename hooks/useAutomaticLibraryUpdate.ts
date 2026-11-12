import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useLibraryUpdatePreferences } from '../contexts/LibraryUpdateContext';
import { getLibraryScanOperation, subscribeLibraryScanOperation } from '../utils/libraryScanOperation';
import type { LibraryScanRequest } from '../utils/libraryScanSources';

const MIN_UPDATE_INTERVAL_MS = 30_000;
const canBeginUpdate = (alive: boolean, pending: number, busy: boolean, inFlight: boolean): boolean =>
  alive && pending > 0 && AppState.currentState === 'active' && !busy && !inFlight
    && getLibraryScanOperation().status !== 'running';
const subscribeToScanActivity = (onStart: () => void, onIdle: () => void): (() => void) => {
  let observed = -1;
  let running = false;
  const check = () => {
    const operation = getLibraryScanOperation();
    if (operation.status === 'running') {
      running = true;
      if (operation.id !== observed) { observed = operation.id; onStart(); }
    } else if (running) { running = false; onIdle(); }
  };
  check();
  return subscribeLibraryScanOperation(check);
};

const createMediaObserver = (onChange: () => void) => {
  let alive = true;
  let request = 0;
  let subscription: ReturnType<typeof MediaLibrary.addListener> | undefined;
  return {
    refresh: () => {
      const current = ++request;
      void MediaLibrary.getPermissionsAsync(false, ['audio']).then(permission => {
        if (!alive || request !== current) return;
        if (permission.status === 'granted' && !subscription) subscription = MediaLibrary.addListener(onChange);
        else if (permission.status !== 'granted' && subscription) { subscription.remove(); subscription = undefined; }
      }).catch(() => undefined);
    },
    remove: () => { alive = false; subscription?.remove(); },
  };
};
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
  const pending = useRef(new Set<'startup' | 'change'>());
  const inFlight = useRef(false);
  useEffect(() => {
    if (!ready || !isHydrated) return;
    if (!preferences.onOpen) pending.current.delete('startup');
    if (!preferences.whileOpen) pending.current.delete('change');
    if (busy && getLibraryScanOperation().status === 'running') {
      pending.current.delete('startup');
      lastStarted.current = Date.now();
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let appState = AppState.currentState;
    const run = async () => {
      timer = undefined;
      if (!canBeginUpdate(alive, pending.current.size, latest.current.busy, inFlight.current)) return;
      if (Date.now() - lastStarted.current < MIN_UPDATE_INTERVAL_MS) { schedule(); return; }
      inFlight.current = true;
      let started = false;
      try {
        const source = 'auto' as const;
        if (!latest.current.hasFolders && (await MediaLibrary.getPermissionsAsync(false, ['audio'])).status !== 'granted') return;
        if (!canBeginUpdate(alive, pending.current.size, latest.current.busy, false)) return;
        if (Date.now() - lastStarted.current < MIN_UPDATE_INTERVAL_MS) { schedule(); return; }
        pending.current.clear();
        started = true;
        lastStarted.current = Date.now();
        await latest.current.update({ source, automatic: true });
      } finally {
        inFlight.current = false;
        if (alive && started && pending.current.size > 0) schedule();
      }
    };
    const schedule = (reason?: 'startup' | 'change') => {
      if (reason) pending.current.add(reason);
      if (timer || pending.current.size === 0) return;
      const wait = Math.max(1000, MIN_UPDATE_INTERVAL_MS - (Date.now() - lastStarted.current));
      timer = setTimeout(() => { void run().catch(() => undefined); }, wait);
    };
    if (!startupHandled.current) {
      startupHandled.current = true;
      if (preferences.onOpen) schedule('startup');
    }
    if (pending.current.size > 0 && !busy) schedule();
    const stopObservingScanStarts = subscribeToScanActivity(() => {
      pending.current.delete('startup'); lastStarted.current = Date.now();
    }, () => {
      if (getLibraryScanOperation().status === 'cancelled') {
        pending.current.clear(); if (timer) clearTimeout(timer); timer = undefined;
      } else schedule();
    });
    const mediaObserver = preferences.whileOpen ? createMediaObserver(() => schedule('change')) : undefined;
    const appSubscription = AppState.addEventListener('change', next => {
      const resumed = next === 'active' && appState !== 'active';
      appState = next;
      if (resumed && preferences.whileOpen) { mediaObserver?.refresh(); schedule('change'); }
    });
    mediaObserver?.refresh();
    return () => { alive = false; if (timer) clearTimeout(timer); appSubscription.remove(); mediaObserver?.remove(); stopObservingScanStarts(); };
  }, [ready, busy, isHydrated, preferences.onOpen, preferences.whileOpen]);
};
