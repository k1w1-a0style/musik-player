import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { LibraryAlertCopy } from './useLibraryAlerts';
import { getLibrarySettingsComingSoonAlert } from '../utils/librarySettingsMessages';

export interface UseLibraryMenuActionsOptions {
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  showAlert: (alert: LibraryAlertCopy) => void;
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
  showAlert,
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
    showAlert(getLibrarySettingsComingSoonAlert());
  }, [setMenuOpen, showAlert]);

  return {
    closeMenu,
    openMenu,
    openSettings,
    toggleSearch,
  };
};
