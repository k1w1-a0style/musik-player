import React, { createContext, useContext, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useHydratedStoredPreference } from '../hooks/useHydratedStoredPreference';
import { storage } from '../utils/storage';
import { ACCENT_PREFERENCES_KEY, DEFAULT_ACCENT_PREFERENCES, normalizeAccentPreferences, type AccentPreferences } from '../utils/accentPreferences';

interface AccentValue {
  preferences: AccentPreferences;
  isHydrated: boolean;
  setPreferences?: Dispatch<SetStateAction<AccentPreferences>>;
  coverAccent?: string;
  setCoverAccent?: Dispatch<SetStateAction<string | undefined>>;
}
const Context = createContext<AccentValue>({ preferences: DEFAULT_ACCENT_PREFERENCES, isHydrated: false });
const load = async () => normalizeAccentPreferences(await storage.get(ACCENT_PREFERENCES_KEY));
const persist = async (value: AccentPreferences) => {
  if (!await storage.set(ACCENT_PREFERENCES_KEY, value)) throw new Error('Accent preference could not be saved');
};
export const AccentPreferencesProvider = ({ children }: { children: React.ReactNode }) => {
  const { value: preferences, setValue: setPreferences, isHydrated } = useHydratedStoredPreference({
    defaultValue: DEFAULT_ACCENT_PREFERENCES, load, persist, normalize: normalizeAccentPreferences, label: 'accent-preferences',
  });
  const [coverAccent, setCoverAccent] = useState<string>();
  const value = useMemo(() => ({ preferences, setPreferences, isHydrated, coverAccent, setCoverAccent }),
    [coverAccent, isHydrated, preferences, setPreferences]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
};
export const useAccentPreferences = (): AccentValue => useContext(Context);
