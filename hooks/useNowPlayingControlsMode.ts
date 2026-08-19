import { useCallback, useEffect } from 'react';
import { storage } from '../utils/storage';
import {
  DEFAULT_NOW_PLAYING_CONTROLS_MODE,
  normalizeNowPlayingPlayerLayout,
  type NowPlayingControlsMode,
} from '../utils/nowPlayingControlsMode';
import { useHydratedStoredPreference } from './useHydratedStoredPreference';

export interface UseNowPlayingControlsModeResult {
  mode: NowPlayingControlsMode;
  isHydrated: boolean;
  setMode: (mode: NowPlayingControlsMode) => void;
}

const STORAGE_KEY = 'nowPlayingPlayerLayout';
const PREVIOUS_STORAGE_KEY = 'nowPlayingControlsMode';
let rememberedMode: NowPlayingControlsMode | null = null;

export const resetRememberedNowPlayingControlsModeForTests = (): void => {
  rememberedMode = null;
};

const normalizeStoredMode = (value: unknown): NowPlayingControlsMode =>
  normalizeNowPlayingPlayerLayout(value);

const loadStoredMode = async (): Promise<NowPlayingControlsMode> => {
  const current = await storage.get(STORAGE_KEY);
  if (current != null) return normalizeStoredMode(current);
  return normalizeStoredMode(await storage.get(PREVIOUS_STORAGE_KEY));
};

const persistStoredMode = async (mode: NowPlayingControlsMode): Promise<void> => {
  await storage.set(STORAGE_KEY, mode);
};

export const useNowPlayingControlsMode = (): UseNowPlayingControlsModeResult => {
  const rememberedModeAtMount = rememberedMode;
  const { value: mode, setValue: setModeState, isHydrated } = useHydratedStoredPreference({
    defaultValue: rememberedModeAtMount ?? DEFAULT_NOW_PLAYING_CONTROLS_MODE,
    load: loadStoredMode,
    persist: persistStoredMode,
    normalize: normalizeStoredMode,
    label: 'now-playing-layout',
  });

  useEffect(() => {
    if (isHydrated) rememberedMode = mode;
  }, [isHydrated, mode]);

  const setMode = useCallback((nextMode: NowPlayingControlsMode) => {
    rememberedMode = nextMode;
    setModeState(nextMode);
  }, [setModeState]);

  return { mode, isHydrated: isHydrated || rememberedModeAtMount !== null, setMode };
};
