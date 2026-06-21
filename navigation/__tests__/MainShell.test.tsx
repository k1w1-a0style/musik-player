import mockReact from 'react';
import { StyleSheet, Text as mockText } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import MainShell, { MAIN_SHELL_MINI_PLAYER_MARGIN } from '../MainShell';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 10, left: 0 }),
}));

jest.mock('../../screens/Library', () => () => mockReact.createElement(mockText, { testID: 'library-screen-stub' }, 'Library'));
jest.mock('../../components/MiniPlayer', () => () => {
  throw new Error('mini player crash');
});

describe('MainShell', () => {
  test('renders the library as the main screen without a bottom tab bar', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { getByTestId } = render(<MainShell openNowPlaying={jest.fn()} />);

    expect(getByTestId('main-shell')).toBeTruthy();
    expect(getByTestId('library-screen-stub')).toBeTruthy();

    consoleErrorSpy.mockRestore();
  });

  test('floats the MiniPlayer fallback above the safe-area bottom, decoupled from any tab bar', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { getByTestId, getByText } = render(<MainShell openNowPlaying={jest.fn()} />);
    const fallbackStyle = StyleSheet.flatten(getByTestId('mini-player-error-boundary-fallback').props.style);

    expect(getByText('Player konnte nicht geladen werden.')).toBeTruthy();
    expect(fallbackStyle.position).toBe('absolute');
    expect(fallbackStyle.bottom).toBe(10 + MAIN_SHELL_MINI_PLAYER_MARGIN);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[MiniPlayer] ErrorBoundary caught an error',
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );

    consoleErrorSpy.mockRestore();
  });

  test('keeps retry/reset available for the MiniPlayer fallback', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { getByTestId } = render(<MainShell openNowPlaying={jest.fn()} />);

    expect(getByTestId('mini-player-error-boundary-fallback')).toBeTruthy();
    fireEvent.press(getByTestId('app-error-boundary-reset'));
    expect(getByTestId('mini-player-error-boundary-fallback')).toBeTruthy();

    consoleErrorSpy.mockRestore();
  });
});
