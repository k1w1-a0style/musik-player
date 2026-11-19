import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import SystemAudio from 'expo-system-audio';
import { useLibraryUpdatePreferences } from '../contexts/LibraryUpdateContext';
import { getLibraryScanOperation, subscribeLibraryScanOperation } from '../utils/libraryScanOperation';
import { DEFAULT_LIBRARY_NATIVE_READ_TIMEOUT_MS } from '../utils/libraryOperationTimeouts';
import type { LibraryScanRequest } from '../utils/libraryScanSources';
import { withTimeout } from '../utils/withTimeout';

const MIN_UPDATE_INTERVAL_MS = 30_000;
type AutomaticUpdateReason = 'startup' | 'change';
const canBeginUpdate = (alive: boolean, pending: number, busy: boolean, inFlight: boolean): boolean =>
  alive && pending > 0 && AppState.currentState === 'active' && !busy && !inFlight
    && getLibraryScanOperation().status !== 'running';
const hasMediaReadGrant = (signal: AbortSignal): Promise<boolean> =>
  withTimeout(() => MediaLibrary.getPermissionsAsync(false, ['audio']), DEFAULT_LIBRARY_NATIVE_READ_TIMEOUT_MS,
    'Medienzugriff konnte nicht bestätigt werden.', { signal })
    .then(permission => permission.status === 'granted', () => false);
// Source selection can change while Android is still answering a grant check.
const createSourcePreflight = (hasFolders: boolean, includeDeviceMusic: boolean) => {
  const controller = new AbortController();
  let checkingPermission = false;
  return {
    isCurrent: () => !controller.signal.aborted,
    dispose: () => controller.abort(),
    async sourceAvailable(): Promise<boolean> {
      if (hasFolders) return true;
      if (!includeDeviceMusic || checkingPermission) return false;
      checkingPermission = true;
      try { return await hasMediaReadGrant(controller.signal); }
      finally { checkingPermission = false; }
    },
  };
};
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
export const useAutomaticLibraryUpdate = ({ ready, busy, hasFolders, folderUris, update }: {
  ready: boolean; busy: boolean; hasFolders: boolean;
  folderUris?: readonly string[];
  update: (options?: LibraryScanRequest) => Promise<void>;
}): void => {
  const { preferences, isHydrated } = useLibraryUpdatePreferences();
  const { includeDeviceMusic } = preferences;
  const latest = useRef({ busy, update });
  latest.current = { busy, update };
  const lastStarted = useRef(-Infinity);
  const startupHandled = useRef(false);
  const pending = useRef(new Set<AutomaticUpdateReason>());
  const inFlight = useRef(false);
  const schedulePending = useRef<(reason?: AutomaticUpdateReason) => void>(() => undefined);
  useEffect(() => {
    if (!ready || !isHydrated) return;
    if (!preferences.onOpen) pending.current.delete('startup');
    if (!preferences.whileOpen) pending.current.delete('change');
    if (busy && getLibraryScanOperation().status === 'running') {
      pending.current.delete('startup');
      lastStarted.current = Date.now();
    }
    const preflight = createSourcePreflight(hasFolders, includeDeviceMusic);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let appState = AppState.currentState;
    const canRun = () => canBeginUpdate(preflight.isCurrent(), pending.current.size, latest.current.busy, inFlight.current);
    const run = async () => {
      timer = undefined;
      if (!canRun()) return;
      if (Date.now() - lastStarted.current < MIN_UPDATE_INTERVAL_MS) { schedule(); return; }
      if (!(await preflight.sourceAvailable()) || !canRun()) return;
      if (Date.now() - lastStarted.current < MIN_UPDATE_INTERVAL_MS) { schedule(); return; }
      inFlight.current = true;
      pending.current.clear();
      lastStarted.current = Date.now();
      try {
        await latest.current.update({ source: 'auto', automatic: true });
      } finally {
        inFlight.current = false;
        schedulePending.current();
      }
    };
    const schedule = (reason?: AutomaticUpdateReason) => {
      if (!preflight.isCurrent()) return;
      if (reason) pending.current.add(reason);
      if (timer || pending.current.size === 0) return;
      const wait = Math.max(1000, MIN_UPDATE_INTERVAL_MS - (Date.now() - lastStarted.current));
      timer = setTimeout(() => { void run().catch(() => undefined); }, wait);
    };
    schedulePending.current = schedule;
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
    const mediaObserver = preferences.whileOpen && includeDeviceMusic ? createMediaObserver(() => schedule('change')) : undefined;
    const appSubscription = AppState.addEventListener('change', next => {
      const resumed = next === 'active' && appState !== 'active';
      appState = next;
      if (resumed && preferences.whileOpen) { mediaObserver?.refresh(); schedule('change'); }
    });
    mediaObserver?.refresh();
    return () => { preflight.dispose(); if (timer) clearTimeout(timer); appSubscription.remove(); mediaObserver?.remove(); stopObservingScanStarts(); };
  }, [ready, busy, hasFolders, isHydrated, includeDeviceMusic, preferences.onOpen, preferences.whileOpen]);
  useEffect(() => {
    if (!ready || !isHydrated || !preferences.whileOpen || !folderUris?.length) return;
    const subscription = SystemAudio.subscribeSafLibraryFolders?.(folderUris, () => schedulePending.current('change'));
    return () => subscription?.remove();
  }, [folderUris, isHydrated, preferences.whileOpen, ready]);
};
