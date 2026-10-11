import React, { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import { useHydratedStoredPreference } from '../hooks/useHydratedStoredPreference';
import { storage } from '../utils/storage';
import { DEFAULT_PLAYER_PRESENTATION, PLAYER_PRESENTATION_KEY, normalizePlayerPresentation,
  type PlayerPresentation } from '../utils/playerPresentation';

interface PresentationValue {
  presentation: PlayerPresentation;
  isHydrated: boolean;
  setPresentation?: Dispatch<SetStateAction<PlayerPresentation>>;
}
const Context = createContext<PresentationValue>({ presentation: DEFAULT_PLAYER_PRESENTATION, isHydrated: false });
const load = async () => normalizePlayerPresentation(await storage.get(PLAYER_PRESENTATION_KEY));
const persist = async (value: PlayerPresentation) => {
  if (!await storage.set(PLAYER_PRESENTATION_KEY, value)) throw new Error('Presentation preference could not be saved');
};
export const PlayerPresentationProvider = ({ children }: { children: React.ReactNode }) => {
  const { value: presentation, setValue: setPresentation, isHydrated } = useHydratedStoredPreference({
    defaultValue: DEFAULT_PLAYER_PRESENTATION, load, persist, normalize: normalizePlayerPresentation,
    label: 'player-presentation',
  });
  return <Context.Provider value={{ presentation, setPresentation, isHydrated }}>{children}</Context.Provider>;
};
export const usePlayerPresentation = (): PresentationValue => useContext(Context);
