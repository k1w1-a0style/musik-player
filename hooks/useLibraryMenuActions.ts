import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export interface UseLibraryMenuActionsOptions {
  searchOpen: boolean;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  setQuery: Dispatch<SetStateAction<string>>;
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
  searchOpen,
  setMenuOpen,
  setQuery,
  setSearchOpen,
  onOpenSettings,
}: UseLibraryMenuActionsOptions): UseLibraryMenuActionsResult => {
  const toggleSearch = useCallback(() => {
    if (searchOpen) setQuery('');
    setSearchOpen(!searchOpen);
  }, [searchOpen, setQuery, setSearchOpen]);

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
