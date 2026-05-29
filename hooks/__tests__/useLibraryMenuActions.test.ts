import { renderHook, act } from '@testing-library/react-native';
import { useState } from 'react';
import { useLibraryMenuActions } from '../useLibraryMenuActions';
import { getLibrarySettingsComingSoonAlert } from '../../utils/librarySettingsMessages';

const useHarness = ({ showAlert = jest.fn() } = {}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const actions = useLibraryMenuActions({ setMenuOpen, setSearchOpen, showAlert });

  return { actions, menuOpen, searchOpen };
};

test('toggleSearch toggles search state', () => {
  const { result } = renderHook(() => useHarness());

  act(() => {
    result.current.actions.toggleSearch();
  });
  expect(result.current.searchOpen).toBe(true);

  act(() => {
    result.current.actions.toggleSearch();
  });
  expect(result.current.searchOpen).toBe(false);
});

test('openMenu and closeMenu update menu state', () => {
  const { result } = renderHook(() => useHarness());

  act(() => {
    result.current.actions.openMenu();
  });
  expect(result.current.menuOpen).toBe(true);

  act(() => {
    result.current.actions.closeMenu();
  });
  expect(result.current.menuOpen).toBe(false);
});

test('openSettings closes menu and shows settings alert', () => {
  const showAlert = jest.fn();
  const { result } = renderHook(() => useHarness({ showAlert }));

  act(() => {
    result.current.actions.openMenu();
  });
  expect(result.current.menuOpen).toBe(true);

  act(() => {
    result.current.actions.openSettings();
  });

  expect(result.current.menuOpen).toBe(false);
  expect(showAlert).toHaveBeenCalledWith(getLibrarySettingsComingSoonAlert());
});
