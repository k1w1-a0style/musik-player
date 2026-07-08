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

export const useNowPlayingControlsMode = (): UseNowPlayingControlsModeResult => {
  const [mode, setModeState] = useState<NowPlayingControlsMode>(DEFAULT_NOW_PLAYING_CONTROLS_MODE);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    storage.getNowPlayingControlsMode()
      .then(storedMode => {
        if (active) setModeState(storedMode);
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
    const safeMode = isNowPlayingControlsMode(nextMode) ? nextMode : DEFAULT_NOW_PLAYING_CONTROLS_MODE;
    setModeState(safeMode);
    void storage.setNowPlayingControlsMode(safeMode).catch(() => undefined);
  }, []);

  return { mode, isHydrated, setMode };
};
