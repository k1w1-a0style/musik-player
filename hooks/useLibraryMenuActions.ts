import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { getLibrarySettingsComingSoonAlert } from '../utils/librarySettingsMessages';

interface LibraryAlertCopy {
  title: string;
  message: string;
}

interface UseLibraryMenuActionsOptions {
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  showAlert: (alert: LibraryAlertCopy) => void;
}

export const useLibraryMenuActions = ({
  setMenuOpen,
  setSearchOpen,
  showAlert,
}: UseLibraryMenuActionsOptions) => {
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
