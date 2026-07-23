import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

export const AppThemeProvider: React.FC<AppThemeProviderProps> = ({ children }) => {
  const [appearance, setAppearanceState] = useState<AppAppearance>(DEFAULT_APP_APPEARANCE);
  const [skin, setSkinState] = useState<AppThemeSkin>(DEFAULT_APP_THEME_SKIN);
  const [isHydrated, setHydrated] = useState(false);
  const mountedRef = useRef(true);
  const appearanceRef = useRef<AppAppearance>(DEFAULT_APP_APPEARANCE);
  const skinRef = useRef<AppThemeSkin>(DEFAULT_APP_THEME_SKIN);
  const persistedAppearanceRef = useRef<AppAppearance>(DEFAULT_APP_APPEARANCE);
  const persistedSkinRef = useRef<AppThemeSkin>(DEFAULT_APP_THEME_SKIN);
  const appearanceWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const skinWriteQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    mountedRef.current = true;

    void (async () => {
      const [storedAppearance, storedSkin] = await Promise.all([
        storage.getAppAppearance().catch(() => DEFAULT_APP_APPEARANCE),
        storage.getAppThemeSkin().catch(() => DEFAULT_APP_THEME_SKIN),
      ]);

      if (!mountedRef.current) return;
      const hydratedAppearance = normalizeAppAppearance(storedAppearance);
      const hydratedSkin = normalizeAppThemeSkin(storedSkin);
      appearanceRef.current = hydratedAppearance;
      skinRef.current = hydratedSkin;
      persistedAppearanceRef.current = hydratedAppearance;
      persistedSkinRef.current = hydratedSkin;
      setAppearanceState(hydratedAppearance);
      setSkinState(hydratedSkin);
      setHydrated(true);
    })();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setAppearance = useCallback((nextAppearance: AppAppearance) => {
    const normalized = normalizeAppAppearance(nextAppearance);
    appearanceRef.current = normalized;
    setAppearanceState(normalized);

    appearanceWriteQueueRef.current = appearanceWriteQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await storage.setAppAppearance(normalized);
          persistedAppearanceRef.current = normalized;
        } catch (error) {
          console.warn('[AppTheme] Appearance persistence failed; reverting to the last stored value.', error);
          if (mountedRef.current && appearanceRef.current === normalized) {
            const fallback = persistedAppearanceRef.current;
            appearanceRef.current = fallback;
            setAppearanceState(fallback);
          }
        }
      });
  }, []);

  const setSkin = useCallback((nextSkin: AppThemeSkin) => {
    const normalized = normalizeAppThemeSkin(nextSkin);
    skinRef.current = normalized;
    setSkinState(normalized);

    skinWriteQueueRef.current = skinWriteQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await storage.setAppThemeSkin(normalized);
          persistedSkinRef.current = normalized;
        } catch (error) {
          console.warn('[AppTheme] Skin persistence failed; reverting to the last stored value.', error);
          if (mountedRef.current && skinRef.current === normalized) {
            const fallback = persistedSkinRef.current;
            skinRef.current = fallback;
            setSkinState(fallback);
          }
        }
      });
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

export const useOptionalAppTheme = (): AppThemeContextValue | null => useContext(AppThemeContext);

export const useAppTheme = (): AppThemeContextValue => {
  const value = useContext(AppThemeContext);
  if (!value) throw new Error('useAppTheme must be used within AppThemeProvider');
  return value;
};
