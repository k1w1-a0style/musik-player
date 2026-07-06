import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_APP_APPEARANCE,
  DEFAULT_APP_THEME_SKIN,
  getAppTheme,
  normalizeAppAppearance,
  normalizeAppThemeSkin,
  type AppAppearance,
  type AppTheme,
  type AppThemeSkin,
} from '../utils/appTheme';
import { storage } from '../utils/storage';

interface AppThemeContextValue {
  appearance: AppAppearance;
  skin: AppThemeSkin;
  theme: AppTheme;
  isHydrated: boolean;
  setAppearance: (appearance: AppAppearance) => void;
  setSkin: (skin: AppThemeSkin) => void;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

interface AppThemeProviderProps {
  children: React.ReactNode;
}

export const AppThemeProvider: React.FC<AppThemeProviderProps> = ({ children }) => {
  const [appearance, setAppearanceState] = useState<AppAppearance>(DEFAULT_APP_APPEARANCE);
  const [skin, setSkinState] = useState<AppThemeSkin>(DEFAULT_APP_THEME_SKIN);
  const [isHydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const [storedAppearance, storedSkin] = await Promise.all([
        storage.getAppAppearance().catch(() => DEFAULT_APP_APPEARANCE),
        storage.getAppThemeSkin().catch(() => DEFAULT_APP_THEME_SKIN),
      ]);

      if (!mounted) return;
      setAppearanceState(normalizeAppAppearance(storedAppearance));
      setSkinState(normalizeAppThemeSkin(storedSkin));
      setHydrated(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setAppearance = useCallback((nextAppearance: AppAppearance) => {
    const normalized = normalizeAppAppearance(nextAppearance);
    setAppearanceState(normalized);
    void storage.setAppAppearance(normalized);
  }, []);

  const setSkin = useCallback((nextSkin: AppThemeSkin) => {
    const normalized = normalizeAppThemeSkin(nextSkin);
    setSkinState(normalized);
    void storage.setAppThemeSkin(normalized);
  }, []);

  const value = useMemo<AppThemeContextValue>(() => ({
    appearance,
    skin,
    theme: getAppTheme(appearance, skin),
    isHydrated,
    setAppearance,
    setSkin,
  }), [appearance, isHydrated, setAppearance, setSkin, skin]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
};

export const useAppTheme = (): AppThemeContextValue => {
  const value = useContext(AppThemeContext);
  if (!value) throw new Error('useAppTheme must be used within AppThemeProvider');
  return value;
};
