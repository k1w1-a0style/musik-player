import { useCallback, useEffect, useState } from 'react';
import { storage } from '../utils/storage';
import {
  DEFAULT_NOW_PLAYING_CONTROLS_MODE,
  isNowPlayingControlsMode,
  type NowPlayingControlsMode,
} from '../utils/nowPlayingControlsMode';

export interface UseNowPlayingControlsModeResult {
  mode: NowPlayingControlsMode;
  isHydrated: boolean;
  setMode: (mode: NowPlayingControlsMode) => void;
}

const STORAGE_KEY = 'nowPlayingControlsMode';

const normalizeStoredMode = (value: unknown): NowPlayingControlsMode =>
  isNowPlayingControlsMode(value) ? value : DEFAULT_NOW_PLAYING_CONTROLS_MODE;

export const useNowPlayingControlsMode = (): UseNowPlayingControlsModeResult => {
  const [mode, setModeState] = useState<NowPlayingControlsMode>(DEFAULT_NOW_PLAYING_CONTROLS_MODE);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    storage.get(STORAGE_KEY)
      .then(storedMode => {
        if (active) setModeState(normalizeStoredMode(storedMode));
      })
      .catch(() => {
        if (active) setModeState(DEFAULT_NOW_PLAYING_CONTROLS_MODE);
      })
      .finally(() => {
        if (active) setIsHydrated(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback((nextMode: NowPlayingControlsMode) => {
    const safeMode = normalizeStoredMode(nextMode);
    setModeState(safeMode);
    void storage.set(STORAGE_KEY, safeMode).catch(() => undefined);
  }, []);

  return { mode, isHydrated, setMode };
};
