import React from 'react';
import { Pressable } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { useLibraryMenuActions } from '../useLibraryMenuActions';

const setMenuOpen = jest.fn();
const setSearchOpen = jest.fn();
const showAlert = jest.fn();

const LibraryMenuActionsProbe = () => {
  const actions = useLibraryMenuActions({
    setMenuOpen,
    setSearchOpen,
    showAlert,
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

  test('toggles search state with updater function', () => {
    const { getByTestId } = render(<LibraryMenuActionsProbe />);

    fireEvent.press(getByTestId('toggle-search'));

    expect(setSearchOpen).toHaveBeenCalledTimes(1);
    const updater = setSearchOpen.mock.calls[0][0] as (value: boolean) => boolean;
    expect(updater(false)).toBe(true);
    expect(updater(true)).toBe(false);
  });

  test('opens and closes menu', () => {
    const { getByTestId } = render(<LibraryMenuActionsProbe />);

    fireEvent.press(getByTestId('open-menu'));
    fireEvent.press(getByTestId('close-menu'));

    expect(setMenuOpen).toHaveBeenNthCalledWith(1, true);
    expect(setMenuOpen).toHaveBeenNthCalledWith(2, false);
  });

  test('closes menu and shows settings alert', () => {
    const { getByTestId } = render(<LibraryMenuActionsProbe />);

    fireEvent.press(getByTestId('open-settings'));

    expect(setMenuOpen).toHaveBeenCalledWith(false);
    expect(showAlert).toHaveBeenCalledWith({
      title: 'Einstellungen',
      message: 'Einstellungen folgen später.',
    });
  });
});
