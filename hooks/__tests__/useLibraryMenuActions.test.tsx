import React from 'react';
import { Pressable } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { useLibraryMenuActions } from '../useLibraryMenuActions';

const setMenuOpen = jest.fn();
const setQuery = jest.fn();
const setSearchOpen = jest.fn();
const onOpenSettings = jest.fn();

const LibraryMenuActionsProbe = ({ searchOpen = false }: { searchOpen?: boolean }) => {
  const actions = useLibraryMenuActions({
    searchOpen,
    setMenuOpen,
    setQuery,
    setSearchOpen,
    onOpenSettings,
  });

  return (
    <>
      <Pressable testID="toggle-search" onPress={actions.toggleSearch} />
      <Pressable testID="open-menu" onPress={actions.openMenu} />
      <Pressable testID="close-menu" onPress={actions.closeMenu} />
      <Pressable testID="open-settings" onPress={actions.openSettings} />
    </>
  );
};

describe('useLibraryMenuActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('opens search without changing the query', () => {
    const { getByTestId } = render(<LibraryMenuActionsProbe />);

    fireEvent.press(getByTestId('toggle-search'));

    expect(setSearchOpen).toHaveBeenCalledWith(true);
    expect(setQuery).not.toHaveBeenCalled();
  });

  test('clears the query when search is closed', () => {
    const { getByTestId } = render(<LibraryMenuActionsProbe searchOpen />);

    fireEvent.press(getByTestId('toggle-search'));

    expect(setQuery).toHaveBeenCalledWith('');
    expect(setSearchOpen).toHaveBeenCalledWith(false);
  });

  test('opens and closes menu', () => {
    const { getByTestId } = render(<LibraryMenuActionsProbe />);

    fireEvent.press(getByTestId('open-menu'));
    fireEvent.press(getByTestId('close-menu'));

    expect(setMenuOpen).toHaveBeenNthCalledWith(1, true);
    expect(setMenuOpen).toHaveBeenNthCalledWith(2, false);
  });

  test('closes menu and opens settings screen', () => {
    const { getByTestId } = render(<LibraryMenuActionsProbe />);

    fireEvent.press(getByTestId('open-settings'));

    expect(setMenuOpen).toHaveBeenCalledWith(false);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
