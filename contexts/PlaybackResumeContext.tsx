import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useHydratedStoredPreference } from '../hooks/useHydratedStoredPreference';
import { storage } from '../utils/storage';
import { RESUME_ENABLED_KEY } from '../utils/resumePosition';
import { ResumePositionStore } from '../utils/resumePositionStore';
import { registerPersistenceFlusher } from '../utils/persistenceMaintenance';

interface ResumeValue {
  enabled: boolean; isHydrated: boolean; store?: ResumePositionStore;
  setEnabled?: (value: boolean) => void; clear?: () => Promise<void>;
}
const Context = createContext<ResumeValue>({ enabled: false, isHydrated: false });
const normalize = (value: boolean): boolean => value === true;
const load = async (): Promise<boolean> => (await storage.get(RESUME_ENABLED_KEY)) === true;
const persist = async (value: boolean): Promise<void> => {
  if (!await storage.set(RESUME_ENABLED_KEY, value)) throw new Error('Resume preference could not be saved.');
};
const warnFlush = (error: unknown): void => console.warn('[Resume] Last accepted position could not be saved.', error);
export const PlaybackResumeProvider = ({ children }: { children: React.ReactNode }) => {
  const [store] = useState(() => new ResumePositionStore());
  const { value: enabled, isHydrated, setValue } = useHydratedStoredPreference({
    defaultValue: false, load, persist, normalize, label: 'playback-resume',
  });
  const enabledRef = useRef(false);
  useLayoutEffect(() => { enabledRef.current = enabled; store.setEnabled(enabled); }, [enabled, store]);
  const setEnabled = useCallback((value: boolean) => {
    // Finish work accepted while On before switching its gate off. No new
    // progress snapshot, positions read, timer or listener starts while Off.
    if (!value && enabledRef.current) void store.flush().catch(warnFlush);
    enabledRef.current = value; store.setEnabled(value); setValue(value);
  }, [setValue, store]);
  useEffect(() => {
    if (!enabled) return;
    return registerPersistenceFlusher(() => { void store.flush().catch(warnFlush); });
  }, [enabled, store]);
  useEffect(() => () => {
    if (enabledRef.current) void store.flush().catch(warnFlush);
    store.setEnabled(false);
  }, [store]);
  const clear = useCallback(() => store.clear(), [store]);
  const value = useMemo(() => ({ enabled, isHydrated, store, setEnabled, clear }), [clear, enabled, isHydrated, setEnabled, store]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
};
export const usePlaybackResume = (): ResumeValue => useContext(Context);
