import React, { createContext, useContext, useMemo } from 'react';
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
import { useHydratedStoredPreference } from '../hooks/useHydratedStoredPreference';
import { storage } from '../utils/storage';

export interface AppThemeContextValue {
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

const loadAppAppearance = (): Promise<AppAppearance> => storage.getAppAppearance();
const persistAppAppearance = (appearance: AppAppearance): Promise<void> => storage.setAppAppearance(appearance);
const loadAppThemeSkin = (): Promise<AppThemeSkin> => storage.getAppThemeSkin();
const persistAppThemeSkin = (skin: AppThemeSkin): Promise<void> => storage.setAppThemeSkin(skin);

export const AppThemeProvider: React.FC<AppThemeProviderProps> = ({ children }) => {
  const {
    value: appearance,
    setValue: setAppearance,
    isHydrated: isAppearanceHydrated,
  } = useHydratedStoredPreference<AppAppearance>({
    defaultValue: DEFAULT_APP_APPEARANCE,
    load: loadAppAppearance,
    persist: persistAppAppearance,
    normalize: normalizeAppAppearance,
    label: 'app-appearance',
  });
  const {
    value: skin,
    setValue: setSkin,
    isHydrated: isSkinHydrated,
  } = useHydratedStoredPreference<AppThemeSkin>({
    defaultValue: DEFAULT_APP_THEME_SKIN,
    load: loadAppThemeSkin,
    persist: persistAppThemeSkin,
    normalize: normalizeAppThemeSkin,
    label: 'app-theme-skin',
  });

  const value = useMemo<AppThemeContextValue>(() => ({
    appearance,
    skin,
    theme: getAppTheme(appearance, skin),
    isHydrated: isAppearanceHydrated && isSkinHydrated,
    setAppearance,
    setSkin,
  }), [appearance, isAppearanceHydrated, isSkinHydrated, setAppearance, setSkin, skin]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
};

export const useOptionalAppTheme = (): AppThemeContextValue | null => useContext(AppThemeContext);

export const useAppTheme = (): AppThemeContextValue => {
  const value = useContext(AppThemeContext);
  if (!value) throw new Error('useAppTheme must be used within AppThemeProvider');
  return value;
};
