import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { useNowPlayingMenu } from '../useNowPlayingMenu';
import { APP_STACK_ROUTES } from '../../types/routes';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
}));

const MenuProbe = ({ songId }: { songId?: string }) => {
  const { menuOpen, openMenu, closeMenu, handleClose, openTrackInfo } = useNowPlayingMenu(songId);

  return (
    <>
      <Text testID="menu-open">{String(menuOpen)}</Text>
      <Pressable testID="open-menu" onPress={openMenu} />
      <Pressable testID="close-menu" onPress={closeMenu} />
      <Pressable testID="close-screen" onPress={handleClose} />
      <Pressable testID="track-info" onPress={openTrackInfo} />
    </>
  );
};

describe('useNowPlayingMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('opens and closes the menu', () => {
    const { getByTestId } = render(<MenuProbe songId="s1" />);

    fireEvent.press(getByTestId('open-menu'));
    expect(getByTestId('menu-open').props.children).toBe('true');

    fireEvent.press(getByTestId('close-menu'));
    expect(getByTestId('menu-open').props.children).toBe('false');
  });

  test('goes back when closing the screen', () => {
    const { getByTestId } = render(<MenuProbe songId="s1" />);

    fireEvent.press(getByTestId('close-screen'));

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('navigates to track info when a song id exists', () => {
    const { getByTestId } = render(<MenuProbe songId="s1" />);

    fireEvent.press(getByTestId('open-menu'));
    fireEvent.press(getByTestId('track-info'));

    expect(mockNavigate).toHaveBeenCalledWith(APP_STACK_ROUTES.TRACK_INFO, { songId: 's1' });
    expect(getByTestId('menu-open').props.children).toBe('false');
  });

  test('does not navigate to track info without a song id', () => {
    const { getByTestId } = render(<MenuProbe />);

    fireEvent.press(getByTestId('track-info'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
