import React, { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import { useHydratedStoredPreference } from '../hooks/useHydratedStoredPreference';
import { storage } from '../utils/storage';
import { DEFAULT_LIBRARY_UPDATE, LIBRARY_UPDATE_KEY, normalizeLibraryUpdate, type LibraryUpdatePreferences } from '../utils/libraryUpdatePreferences';
interface LibraryUpdateValue {
  preferences: LibraryUpdatePreferences;
  isHydrated: boolean;
  setPreferences?: Dispatch<SetStateAction<LibraryUpdatePreferences>>;
}
const Context = createContext<LibraryUpdateValue>({ preferences: DEFAULT_LIBRARY_UPDATE, isHydrated: false });
const load = async () => normalizeLibraryUpdate(await storage.get(LIBRARY_UPDATE_KEY));
const persist = async (value: LibraryUpdatePreferences) => {
  if (!await storage.set(LIBRARY_UPDATE_KEY, value)) throw new Error('Automatische Aktualisierung konnte nicht gespeichert werden');
};
export const LibraryUpdateProvider = ({ children }: { children: React.ReactNode }) => {
  const { value: preferences, setValue: setPreferences, isHydrated } = useHydratedStoredPreference({
    defaultValue: DEFAULT_LIBRARY_UPDATE, load, persist, normalize: normalizeLibraryUpdate, label: 'library-update',
  });
  return <Context.Provider value={{ preferences, setPreferences, isHydrated }}>{children}</Context.Provider>;
};
export const useLibraryUpdatePreferences = () => useContext(Context);
