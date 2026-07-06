import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export interface UseLibraryMenuActionsOptions {
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  onOpenSettings: () => void;
}

export interface UseLibraryMenuActionsResult {
  closeMenu: () => void;
  openMenu: () => void;
  openSettings: () => void;
  toggleSearch: () => void;
}

export const useLibraryMenuActions = ({
  setMenuOpen,
  setSearchOpen,
  onOpenSettings,
}: UseLibraryMenuActionsOptions): UseLibraryMenuActionsResult => {
  const toggleSearch = useCallback(() => {
    setSearchOpen(value => !value);
  }, [setSearchOpen]);

  const openMenu = useCallback(() => {
    setMenuOpen(true);
  }, [setMenuOpen]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, [setMenuOpen]);

  const openSettings = useCallback(() => {
    setMenuOpen(false);
    onOpenSettings();
  }, [onOpenSettings, setMenuOpen]);

  return {
    closeMenu,
    openMenu,
    openSettings,
    toggleSearch,
  };
};
